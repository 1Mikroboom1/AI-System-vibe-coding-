import express from "express";
import cors from "cors";
import { config } from "dotenv";
import path from "path";
import helmet from "helmet";
import multer from "multer";
import type { Express } from "express";
import type { Server } from "http";
import {
  normalizeApiKey,
  normalizeBaseUrl,
  sendAnthropicMessage,
  sendOpenAICompatibleMessage,
  sendOpenAIMessage,
  testOmniRouteConnection,
  fetchOpenRouterModels,
  testProviderConnection,
  type SupportedProvider
} from "../lib/providers";

config({ path: path.resolve(__dirname, "../../.env") });

export interface StartServerOptions {
  port?: number;
  host?: string;
  serveStatic?: boolean;
}

type ProviderName = SupportedProvider;

type AppSettings = {
  provider?: ProviderName;
  apiKey?: string;
  model?: string;
  omniRouteBaseUrl?: string;
  openRouterBaseUrl?: string;
  openRouterFavorites?: string[];
  activeModelId?: string;
  models?: Array<{
    id: string;
    name: string;
    provider: ProviderName;
    model: string;
  }>;
};

const settingsStore: AppSettings = {};
const chatHistoryStore = new Map<string, Array<{ role: "user" | "assistant"; content: string; createdAt: string }>>();

const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_LOCAL_MODEL_BASE_URL = process.env.LOCAL_MODEL_BASE_URL || "http://localhost:11434/v1";
const DEFAULT_OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1";
const CHAT_MAX_FILES = 8;
const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024;

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: CHAT_MAX_FILES,
    fileSize: CHAT_MAX_FILE_SIZE
  }
});

class ProviderHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ProviderHttpError";
    this.statusCode = statusCode;
  }
}



function normalizeModelPresets(value: unknown): AppSettings["models"] {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<{ id: string; name: string; provider: ProviderName; model: string }>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const provider = candidate.provider;
      const model = typeof candidate.model === "string" ? candidate.model.trim() : "";
      if (!id || !name || !model) return null;
      if (
        provider !== "Anthropic" &&
        provider !== "OmniRoute" &&
        provider !== "OpenAI" &&
        provider !== "Grok" &&
        provider !== "Qwen" &&
        provider !== "DeepSeek" &&
        provider !== "OpenRouter" &&
        provider !== "Local Model"
      ) return null;
      return { id, name, provider, model };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return normalized;
}

function isLikelyAnthropicApiKey(value: string): boolean {
  return /^sk-ant-[A-Za-z0-9\-_]+$/.test(value) && value.length >= 24;
}

function isTextLikeMime(mime: string): boolean {
  return /^text\//i.test(mime) || /json|xml|yaml|csv|javascript|typescript|markdown|html/i.test(mime);
}

function buildQuestionWithFiles(question: string, files: Express.Multer.File[]): string {
  if (!files.length) {
    return question;
  }

  const fileContext = files.map((file) => {
    const info = `[File name=${file.originalname}; mime=${file.mimetype || "application/octet-stream"}; size=${file.size} bytes]`;

    if (file.buffer && file.buffer.length > 0) {
      if (isTextLikeMime(file.mimetype || "")) {
        const asText = file.buffer.toString("utf8").slice(0, 8000);
        return `${info}\n${asText}`;
      }

      const asBase64 = file.buffer.toString("base64").slice(0, 2000);
      return `${info}\nBinary preview (base64, truncated): ${asBase64}`;
    }

    return info;
  });

  return `${question}\n\nAttached files:\n${fileContext.join("\n\n")}`;
}

async function callAnthropic(question: string, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }
  return sendAnthropicMessage(settingsStore.apiKey, {
    model: modelName || settingsStore.model || DEFAULT_ANTHROPIC_MODEL,
    messages: [
      {
        role: "user",
        content: question
      }
    ],
    max_tokens: 512,
    temperature: 0.7
  });
}

async function callOpenAI(question: string, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return sendOpenAIMessage(settingsStore.apiKey, {
    model: modelName || settingsStore.model || DEFAULT_OPENAI_MODEL,
    messages: [
      {
        role: "user",
        content: question
      }
    ],
    max_tokens: 512,
    temperature: 0.7
  });
}

type CompatibleProvider = "OmniRoute" | "Grok" | "Qwen" | "DeepSeek" | "OpenRouter" | "Local Model";

function getCompatibleProviderBaseUrl(provider: CompatibleProvider): string {
  const configuredBaseUrl = settingsStore.provider === provider ? settingsStore.omniRouteBaseUrl : undefined;

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  switch (provider) {
    case "Local Model":
      return DEFAULT_LOCAL_MODEL_BASE_URL;
    case "Grok":
      return process.env.XAI_BASE_URL || "https://api.x.ai/v1";
    case "Qwen":
      return process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    case "DeepSeek":
      return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    case "OpenRouter":
      return process.env.OPENROUTER_BASE_URL || settingsStore.openRouterBaseUrl || "https://openrouter.ai/v1";
    case "OmniRoute":
    default:
      return DEFAULT_OMNIROUTE_BASE_URL;
  }
}

async function callOpenAICompatibleProvider(question: string, modelName: string, provider: CompatibleProvider): Promise<string> {
  const baseUrl = getCompatibleProviderBaseUrl(provider);

  const apiKey = provider === "Local Model" ? undefined : settingsStore.apiKey;
  if (provider === "OmniRoute" && !apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return sendOpenAICompatibleMessage(baseUrl, apiKey, {
    model: modelName,
    messages: [
      {
        role: "user",
        content: question
      }
    ],
    max_tokens: 512,
    temperature: 0.7
  });
}

async function callOmniRoute(question: string, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "OmniRoute");
}

async function callGrok(question: string, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "Grok");
}

async function callQwen(question: string, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "Qwen");
}

async function callDeepSeek(question: string, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "DeepSeek");
}

async function callLocalModel(question: string, modelName: string): Promise<string> {
  return callOpenAICompatibleProvider(question, modelName, "Local Model");
}

function configureApp(app: Express, serveStatic: boolean): void {
  app.use(cors({
    origin: process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://localhost:5000"]
      : true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  app.use(express.json());
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "ws://localhost:*", "http://localhost:*"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Super Chat API is running" });
  });

  app.post("/api/rag/import-document", (_req, res) => {
    res.json({ success: true, message: "Document import endpoint" });
  });

  app.post("/api/rag/chat", (req, res, next) => {
    const contentType = req.headers["content-type"];
    if (typeof contentType === "string" && contentType.includes("multipart/form-data")) {
      chatUpload.array("files", CHAT_MAX_FILES)(req, res, (err: unknown) => {
        if (err) {
          const message = err instanceof Error ? err.message : "Invalid multipart upload";
          return res.status(400).json({ success: false, error: message });
        }
        next();
      });
      return;
    }
    next();
  }, (req, res) => {
    try {
      console.log('[CHAT] Received request. Body:', JSON.stringify(req.body));
      const { question, provider, model } = req.body || {};
      const uploadedFiles = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
      const normalizedQuestion = typeof question === "string" && question.trim()
        ? question.trim()
        : (uploadedFiles.length ? "Analyze attached files" : "");

      if (!normalizedQuestion) {
        console.log('[CHAT] Missing question, returning 400');
        return res.status(400).json({ success: false, error: 'Missing question' });
      }

      const providerQuestion = buildQuestionWithFiles(normalizedQuestion, uploadedFiles);
      const selectedPreset = settingsStore.models?.find((item) => item.id === settingsStore.activeModelId);
      const activeProvider = (provider || selectedPreset?.provider || settingsStore.provider || "Anthropic") as ProviderName;
      const activeModel = typeof model === "string" && model.trim()
        ? model.trim()
        : (selectedPreset?.model || settingsStore.model || "");
      if (!activeModel) {
        console.log('[CHAT] No model configured');
        return res.status(400).json({ success: false, error: 'No models are configured. Add one in Settings first.' });
      }
      console.log('[CHAT] Active provider:', activeProvider, 'Active model:', activeModel);
      const historyKey = `${activeProvider}:${activeModel}`;
      const previousHistory = chatHistoryStore.get(historyKey) ?? [];
      chatHistoryStore.set(historyKey, [
        ...previousHistory,
        {
          role: "user",
          content: uploadedFiles.length
            ? `${String(normalizedQuestion)}\n(${uploadedFiles.length} attachment${uploadedFiles.length > 1 ? "s" : ""})`
            : String(normalizedQuestion),
          createdAt: new Date().toISOString()
        }
      ]);
      const supportedProviders: ProviderName[] = ["Anthropic", "OmniRoute", "OpenAI", "Grok", "Qwen", "DeepSeek", "OpenRouter", "Local Model"];
      if (!supportedProviders.includes(activeProvider)) {
        console.log('[CHAT] Provider not supported:', activeProvider);
        return res.status(400).json({ success: false, error: `Provider ${activeProvider} is not implemented yet.` });
      }
      if (activeProvider === "Anthropic" && !settingsStore.apiKey) {
        console.log('[CHAT] No API key configured for Anthropic');
        return res.status(400).json({ success: false, error: 'Anthropic API key not configured. Please save settings.' });
      }
      if (activeProvider === "Anthropic" && settingsStore.apiKey && !isLikelyAnthropicApiKey(settingsStore.apiKey)) {
        console.log('[CHAT] Invalid Anthropic key');
        return res.status(400).json({ success: false, error: 'Anthropic API key format is invalid. Expected key that starts with sk-ant-.' });
      }
      if (activeProvider !== "Local Model" && !settingsStore.apiKey) {
        console.log('[CHAT] No API key configured');
        return res.status(400).json({ success: false, error: 'Model API key not configured. Please save settings.' });
      }
      console.log('[CHAT] All validation passed. Question length:', String(providerQuestion).length, 'Using provider:', activeProvider, 'Model:', activeModel);
      let providerCall: Promise<string>;
      switch (activeProvider) {
        case "Anthropic":
          providerCall = callAnthropic(String(providerQuestion), activeModel);
          break;
        case "OpenAI":
          providerCall = callOpenAI(String(providerQuestion), activeModel);
          break;
        case "OmniRoute":
          providerCall = callOmniRoute(String(providerQuestion), activeModel);
          break;
        case "Grok":
          providerCall = callGrok(String(providerQuestion), activeModel);
          break;
        case "Qwen":
          providerCall = callQwen(String(providerQuestion), activeModel);
          break;
        case "DeepSeek":
          providerCall = callDeepSeek(String(providerQuestion), activeModel);
          break;
        case "OpenRouter":
          if (!settingsStore.apiKey) {
            throw new Error("Model API key not configured. Please save settings.");
          }
          providerCall = callOpenAICompatibleProvider(String(providerQuestion), activeModel, "OpenRouter");
          break;
        case "Local Model":
          providerCall = callLocalModel(String(providerQuestion), activeModel);
          break;
        default:
          return res.status(400).json({ success: false, error: `Provider ${activeProvider} is not implemented yet.` });
      }
      console.log('[CHAT] Provider call initiated:', activeProvider);

      providerCall
        .then((answer) => {
          chatHistoryStore.set(historyKey, [
            ...previousHistory,
            { role: "user", content: String(question), createdAt: new Date().toISOString() },
            { role: "assistant", content: answer, createdAt: new Date().toISOString() }
          ]);
          res.json({
            success: true,
            message: 'Chat endpoint',
            answer,
            provider: activeProvider,
            model: activeModel,
            attachments: uploadedFiles.map((file) => ({
              name: file.originalname,
              size: file.size,
              type: file.mimetype || "application/octet-stream"
            }))
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown provider error';
          const statusCode = error instanceof ProviderHttpError ? error.statusCode : 502;
          console.error('[CHAT] Request failed:', message);
          const updatedHistory = chatHistoryStore.get(historyKey) ?? [];
          chatHistoryStore.set(historyKey, [
            ...updatedHistory,
            { role: "assistant", content: `Error: ${message}`, createdAt: new Date().toISOString() }
          ]);
          res.status(statusCode).json({ success: false, error: message });
        });
    } catch (syncError: unknown) {
      const errorMsg = syncError instanceof Error ? syncError.message : 'Unknown sync error';
      console.error('[CHAT] Sync error in handler:', errorMsg);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: `Sync error: ${errorMsg}` });
      }
    }
  });

  app.post("/api/rag/semantic-search", (_req, res) => {
    res.json({ success: true, results: [] });
  });

  app.get('/api/rag/history', (req, res) => {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : (settingsStore.provider || 'Anthropic');
    const model = typeof req.query.model === 'string' ? req.query.model : (settingsStore.model || DEFAULT_ANTHROPIC_MODEL);
    const historyKey = `${provider}:${model}`;
    res.json({ success: true, provider, model, history: chatHistoryStore.get(historyKey) ?? [] });
  });

  // OmniRoute connection test endpoint
  app.post('/api/providers/test', async (req, res) => {
    try {
      const { provider, baseUrl, apiKey, model } = req.body || {};

      if (!provider) {
        return res.status(400).json({
          success: false,
          status: 'error',
          message: 'Provider is required'
        });
      }

      const result = await testProviderConnection(provider, { baseUrl, apiKey, model });

      return res.json({
        success: result.status === 'connected',
        ...result
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OMNIROUTE_TEST]', message);
      res.status(500).json({
        success: false,
        status: 'error',
        message: `Connection test failed: ${message}`
      });
    }
  });

  // OpenRouter models endpoints
  app.get('/api/openrouter/models', async (req, res) => {
    try {
      const baseUrl = (req.query.baseUrl as string) || settingsStore.openRouterBaseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/v1';
      const apiKey = (req.query.apiKey as string) || settingsStore.apiKey;
      const models = await fetchOpenRouterModels(baseUrl, apiKey);
      // Filter and mark free models
      const enriched = models.map((m: any) => {
        const pricing = m?.pricing ?? m?.metadata?.pricing ?? m?.price ?? {};
        const free = pricing && (pricing.prompt === 0 || pricing.completion === 0 || (pricing?.prompt === 0 && pricing?.completion === 0));
        return { ...m, free: Boolean(free) };
      });
      res.json({ success: true, models: enriched });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  });

  app.post('/api/openrouter/refresh-models', async (req, res) => {
    try {
      const baseUrl = req.body?.baseUrl || settingsStore.openRouterBaseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/v1';
      const apiKey = req.body?.apiKey || settingsStore.apiKey;
      const models = await fetchOpenRouterModels(baseUrl, apiKey);
      res.json({ success: true, models });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  });

  // Favorites endpoints for OpenRouter free models
  app.get('/api/openrouter/favorites', (_req, res) => {
    res.json({ success: true, favorites: settingsStore.openRouterFavorites ?? [] });
  });

  app.post('/api/openrouter/favorites', (req, res) => {
    const favs = req.body?.favorites;
    if (!Array.isArray(favs)) {
      return res.status(400).json({ success: false, message: 'favorites must be an array' });
    }
    settingsStore.openRouterFavorites = favs.map((s: unknown) => String(s).trim()).filter(Boolean);
    res.json({ success: true, favorites: settingsStore.openRouterFavorites });
  });

  app.post('/api/omniroute/test', async (req, res) => {
    try {
      const { baseUrl, apiKey, model } = req.body || {};

      if (!baseUrl || !apiKey) {
        return res.status(400).json({
          success: false,
          status: 'error',
          message: 'Base URL and API Key are required'
        });
      }

      const result = await testOmniRouteConnection(baseUrl, apiKey);

      return res.json({
        success: result.status === 'connected',
        ...result,
        model
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OMNIROUTE_TEST]', message);
      res.status(500).json({
        success: false,
        status: 'error',
        message: `Connection test failed: ${message}`
      });
    }
  });

  // attach settings endpoints
  registerSettingsEndpoints(app);

  if (serveStatic) {
    const staticPath = path.resolve(__dirname, "../..");
    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }
}

export function createApp(serveStatic = false): Express {
  const app = express();
  configureApp(app, serveStatic);
  return app;
}

export function startServer(options: StartServerOptions = {}): Server {
  const port = options.port ?? parseInt(process.env.PORT || "5000", 10);
  const host = options.host ?? "0.0.0.0";
  const app = createApp(options.serveStatic ?? false);

  return app.listen(port, host, () => {
    console.log(`Super Chat API running on http://${host}:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

// Expose settings endpoints for frontend
export function registerSettingsEndpoints(app: Express) {
  app.get('/api/settings', (_req, res) => {
    res.json({
      success: true,
      settings: {
        provider: settingsStore.provider ?? null,
        apiKey: settingsStore.apiKey ? '****' : null,
        model: settingsStore.model ?? DEFAULT_ANTHROPIC_MODEL,
        omniRouteBaseUrl: settingsStore.omniRouteBaseUrl ?? DEFAULT_OMNIROUTE_BASE_URL,
        activeModelId: settingsStore.activeModelId ?? null,
        models: settingsStore.models ?? []
      }
    });
  });

  app.post('/api/settings', (req, res) => {
    const { provider, apiKey, model, omniRouteBaseUrl, activeModelId, models } = req.body || {};
    if (provider) settingsStore.provider = provider;
    const normalizedKey = normalizeApiKey(apiKey);
    if (normalizedKey) {
      if ((settingsStore.provider || provider || 'Anthropic') === 'Anthropic' && !isLikelyAnthropicApiKey(normalizedKey)) {
        settingsStore.apiKey = undefined;
        return res.status(400).json({
          success: false,
          message: 'Invalid Anthropic API key format. Expected an official key from Anthropic Console that starts with sk-ant-.'
        });
      }
      settingsStore.apiKey = normalizedKey;
    }
    const normalizedBaseUrl = normalizeBaseUrl(omniRouteBaseUrl);
    if (normalizedBaseUrl) {
      settingsStore.omniRouteBaseUrl = normalizedBaseUrl;
    }
    // OpenRouter base URL
    const normalizedOpenRouterBase = normalizeBaseUrl(req.body?.openRouterBaseUrl ?? req.body?.openrouterBaseUrl ?? undefined);
    if (normalizedOpenRouterBase) {
      settingsStore.openRouterBaseUrl = normalizedOpenRouterBase;
    }
    // OpenRouter favorites
    if (Array.isArray(req.body?.openRouterFavorites)) {
      settingsStore.openRouterFavorites = req.body.openRouterFavorites.map((s: unknown) => String(s).trim()).filter(Boolean);
    }
    const normalizedModels = normalizeModelPresets(models);
    if (normalizedModels) {
      settingsStore.models = normalizedModels;
      if (!activeModelId && !normalizedModels.some((item) => item.id === settingsStore.activeModelId)) {
        settingsStore.activeModelId = normalizedModels[0]?.id;
      }
    }
    if (typeof activeModelId === 'string' && activeModelId.trim()) {
      settingsStore.activeModelId = activeModelId.trim();
      const selectedModel = (settingsStore.models ?? []).find((item) => item.id === settingsStore.activeModelId);
      if (selectedModel) {
        settingsStore.provider = selectedModel.provider;
        settingsStore.model = selectedModel.model;
      }
    }
    if (model) settingsStore.model = model;
    console.log('Settings updated. Provider:', settingsStore.provider, 'API key present:', !!settingsStore.apiKey);
    res.json({ success: true, message: 'Settings saved' });
  });
}
