import express from "express";
import cors from "cors";
import { config } from "dotenv";
import path from "path";
import helmet from "helmet";
import multer from "multer";
import { LocalDocumentModel } from "../local-model/document-model";
import type { Express } from "express";
import type { Server } from "http";
import { fileURLToPath } from "url";

console.log("🚀 Server.ts loaded");
console.log('[SERVER] PID:', process.pid, 'cwd:', process.cwd());
console.log('[SERVER] startToken:', Math.random().toString(36).slice(2, 8));

// Derive __filename and __dirname in both ESM and CommonJS builds
let __filename = "";
let __dirname = "";
try {
  // ESM environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _filename = fileURLToPath((import.meta && (import.meta as any).url) as string);
  __filename = _filename;
  __dirname = path.dirname(_filename);
} catch (err) {
  // CommonJS or bundled environment - fallback to process.argv or cwd
  __filename = process.argv && process.argv[1] ? process.argv[1] : "";
  __dirname = __filename ? path.dirname(__filename) : process.cwd();
}

// Provider types
export type SupportedProvider = "Anthropic" | "OmniRoute" | "OpenAI" | "Grok" | "Qwen" | "DeepSeek" | "OpenRouter" | "Local Model";
export type ProviderConnectionResult = { status: "connected" | "error" | "unreachable"; message: string; details?: string };

// Stub/provider helper functions
const normalizeApiKey = (key?: string): string | undefined => key?.trim();
const normalizeBaseUrl = (url?: string): string | undefined => url?.trim().replace(/\/+$/, "");

async function parseProviderResponseText(text: string, _res: Response): Promise<string> {
  try {
    const json = JSON.parse(text);
    const choice = json.choices?.[0];
    if (choice) {
      if (choice.message?.content) return String(choice.message.content);
      if (typeof choice.text === "string") return choice.text;
      if (choice.delta?.content) return String(choice.delta.content);
    }
    if (typeof json.result === "string") return json.result;
    if (json.output?.[0]?.content) {
      const out = json.output[0].content;
      if (Array.isArray(out)) {
        for (const part of out) {
          if (typeof part === "string") return part;
          if (part?.text) return part.text;
        }
      }
    }
    return JSON.stringify(json);
  } catch (err) {
    // not JSON
    return text || "";
  }
}

const sendAnthropicMessage = async (_apiKey: string, _options: any): Promise<string> => {
  // Anthropic support can be added later; keep current mock for now
  return "Mock Anthropic response";
};

const sendOpenAICompatibleMessage = async (baseUrl: string, apiKey: string, options: any): Promise<string> => {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  console.log('[PROVIDER_CALL] OpenAI-compatible ->', endpoint);
  try {
    console.log('[PROVIDER_CALL] headers:', Object.keys(headers).join(', '));
    console.log('[PROVIDER_CALL] body preview:', JSON.stringify(options).slice(0, 1000));

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(options),
    });

    const text = await res.text();
    console.log('[PROVIDER_CALL] response status:', res.status);
    console.log('[PROVIDER_CALL] response length:', text?.length ?? 0);
    if (!res.ok) {
      const body = text || res.statusText;
      console.error('[PROVIDER_CALL] non-ok response:', res.status, body);
      throw new Error(`Provider error ${res.status}: ${body}`);
    }

    const parsed = await parseProviderResponseText(text, res);
    console.log('[PROVIDER_CALL] parsed reply length:', parsed?.length ?? 0);
    return parsed;
  } catch (err) {
    console.error('[PROVIDER_CALL] error', err instanceof Error ? err.message : String(err));
    throw err;
  }
};

const sendOpenAIMessage = async (apiKey: string, options: any): Promise<string> => {
  const endpoint = `https://api.openai.com/v1/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  console.log('[OPENAI_CALL] endpoint:', endpoint);
  try {
    console.log('[OPENAI_CALL] headers:', Object.keys(headers).join(', '));
    console.log('[OPENAI_CALL] body preview:', JSON.stringify(options).slice(0, 1000));

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(options),
    });

    const text = await res.text();
    console.log('[OPENAI_CALL] response status:', res.status);
    if (!res.ok) {
      const body = text || res.statusText;
      console.error('[OPENAI_CALL] non-ok response:', res.status, body);
      throw new Error(`OpenAI error ${res.status}: ${body}`);
    }

    const parsed = await parseProviderResponseText(text, res);
    console.log('[OPENAI_CALL] parsed reply length:', parsed?.length ?? 0);
    return parsed;
  } catch (err) {
    console.error('[OPENAI_CALL] error', err instanceof Error ? err.message : String(err));
    throw err;
  }
};

const testOmniRouteConnection = async (_baseUrl: string, _apiKey: string): Promise<ProviderConnectionResult> => ({ status: "connected", message: "OmniRoute connected" });
const testProviderConnection = async (provider: SupportedProvider, _options: any): Promise<ProviderConnectionResult> => ({ status: "connected", message: `${provider} connected` });

// Mock OpenRouter models fetcher
let _openRouterModelsCache: { fetchedAt: number; baseUrl: string; models: any[] } | null = null;
const fetchOpenRouterModels = async (baseUrl: string, _apiKey?: string): Promise<any[]> => {
  const now = Date.now();
  if (_openRouterModelsCache && _openRouterModelsCache.baseUrl === baseUrl && now - _openRouterModelsCache.fetchedAt < 1000 * 60 * 5) {
    return _openRouterModelsCache.models;
  }
  // Return mock models
  const models = [
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", pricing: { prompt: 0.5, completion: 1.5 }, free: false },
    { id: "llama-2-70b-chat", name: "Llama 2 70B Chat", provider: "meta", pricing: { prompt: 0, completion: 0 }, free: true },
    { id: "mistral-7b", name: "Mistral 7B", provider: "mistral", pricing: { prompt: 0, completion: 0 }, free: true }
  ];
  _openRouterModelsCache = { fetchedAt: now, baseUrl, models };
  return models;
};

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
const localDocumentModel = new LocalDocumentModel();

type LocalFieldType = "string" | "number" | "date" | "email" | "phone" | "amount";

type LocalFieldDefinition = {
  id: string;
  name: string;
  type: LocalFieldType;
  enabled: boolean;
  hint?: string;
};

type LocalFieldResult = {
  fieldId: string;
  fieldName: string;
  type: LocalFieldType;
  value: string;
  confidence: number;
  source: "regex" | "hint-line" | "fallback";
};

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

const localModelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 16,
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

function normalizeLocalFieldType(value: unknown): LocalFieldType {
  if (value === "number" || value === "date" || value === "email" || value === "phone" || value === "amount") {
    return value;
  }
  return "string";
}

function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

type OpenAIUserContent = string | OpenAIContentPart[];

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

function buildMultimodalContent(question: string, files: Express.Multer.File[]): OpenAIUserContent {
  if (!files.length) {
    return question;
  }

  const textNotes: string[] = [question, "", "Attached files:"];
  const content: OpenAIContentPart[] = [];

  for (const file of files) {
    const mime = file.mimetype || "application/octet-stream";
    textNotes.push(`- ${file.originalname} (${mime}, ${file.size} bytes)`);

    if (!file.buffer || file.buffer.length === 0) {
      continue;
    }

    if (isImageMime(mime)) {
      const base64 = file.buffer.toString("base64");
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${mime};base64,${base64}`,
          detail: "auto"
        }
      });
      continue;
    }

    if (isTextLikeMime(mime)) {
      const asText = file.buffer.toString("utf8").slice(0, 8000);
      textNotes.push(`\n[${file.originalname} content]\n${asText}`);
      continue;
    }

    textNotes.push(`\n[${file.originalname}] Binary file attached (type: ${mime}).`);
  }

  // Keep a text anchor first so the model always has clear instruction context.
  content.unshift({
    type: "text",
    text: textNotes.join("\n")
  });

  return content;
}

async function callAnthropic(question: OpenAIUserContent, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  const textQuestion = typeof question === "string"
    ? question
    : question
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");

  return sendAnthropicMessage(settingsStore.apiKey, {
    model: modelName || settingsStore.model || DEFAULT_ANTHROPIC_MODEL,
    messages: [
      {
        role: "user",
        content: textQuestion
      }
    ],
    max_tokens: 512,
    temperature: 0.7
  });
}

async function callOpenAI(question: OpenAIUserContent, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  console.log('[CALL_OPENAI] calling sendOpenAIMessage, apiKey present:', !!settingsStore.apiKey);
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



function normalizeCompatibleModel(modelName: string, provider: CompatibleProvider): string {
  const trimmed = typeof modelName === 'string' ? modelName.trim() : '';
  const fallback = provider === 'OpenRouter'
    ? (process.env.OPENROUTER_MODEL || 'openai/gpt-chat-latest')
    : (process.env.OMNIROUTE_MODEL || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);

  if (!trimmed) return fallback;

  const looksLikePlaceholder = /^(free|no|none|select|choose|placeholder|openrouter)$/i.test(trimmed) || /free models?/i.test(trimmed);
  const looksLikeId = trimmed.includes('/') || /^[a-z0-9\-_.]+$/i.test(trimmed);

  if (looksLikePlaceholder || !looksLikeId) {
    console.warn('[CALL_COMPAT] Model normalized:', trimmed, '->', fallback);
    return fallback;
  }

  return trimmed;
}

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

async function callOpenAICompatibleProvider(question: OpenAIUserContent, modelName: string, provider: CompatibleProvider): Promise<string> {
  const baseUrl = getCompatibleProviderBaseUrl(provider);
  const normalizedModel = normalizeCompatibleModel(modelName, provider);

  const apiKey = provider === "Local Model" ? undefined : settingsStore.apiKey;
  if (provider === "OmniRoute" && !apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  console.log('[CALL_COMPAT] provider:', provider, 'baseUrl:', baseUrl, 'model:', normalizedModel, 'apiKeyPresent:', !!apiKey);
  console.log('[CALL_COMPAT] sendOpenAICompatibleMessage type:', typeof sendOpenAICompatibleMessage);

  return sendOpenAICompatibleMessage(baseUrl, apiKey || "", {
    model: normalizedModel,
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

async function callOmniRoute(question: OpenAIUserContent, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "OmniRoute");
}

async function callGrok(question: OpenAIUserContent, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "Grok");
}

async function callQwen(question: OpenAIUserContent, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "Qwen");
}

async function callDeepSeek(question: OpenAIUserContent, modelName: string): Promise<string> {
  if (!settingsStore.apiKey) {
    throw new Error("Model API key not configured. Please save settings.");
  }

  return callOpenAICompatibleProvider(question, modelName, "DeepSeek");
}

async function callLocalModel(question: OpenAIUserContent, modelName: string): Promise<string> {
  return callOpenAICompatibleProvider(question, modelName, "Local Model");
}

function configureApp(app: Express, serveStatic: boolean): void {
  app.use(cors({
    origin: process.env.NODE_ENV === "development"
      ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/
      : ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  app.use(express.json());
  // Simple request logger for debugging incoming client requests
  app.use((req, _res, next) => {
    try {
      console.log(`[REQ] ${req.method} ${req.url} headers:`, JSON.stringify(req.headers));
    } catch (e) {
      console.log(`[REQ] ${req.method} ${req.url}`);
    }
    next();
  });
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

  app.get("/api/local-doc-model/state", (_req, res) => {
    const state = localDocumentModel.getState();
    res.json({
      success: true,
      model: {
        name: state.model,
        fields: state.fields,
        samplesCount: state.samplesCount,
        updatedAt: state.updatedAt
      }
    });
  });

  app.post("/api/local-doc-model/fields", (req, res) => {
    try {
      const incoming = req.body?.fields;
      if (!Array.isArray(incoming) || incoming.length === 0) {
        return res.status(400).json({ success: false, error: "fields must be a non-empty array" });
      }

      const normalized = incoming
        .map((item: unknown, index: number) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Partial<LocalFieldDefinition>;
          const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
          if (!name) return null;
          const id = typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id.trim()
            : `field-${index + 1}-${Date.now()}`;
          const hint = typeof candidate.hint === "string" ? candidate.hint.trim() : undefined;
          return {
            id,
            name,
            type: normalizeLocalFieldType(candidate.type),
            enabled: candidate.enabled !== false,
            hint
          } as LocalFieldDefinition;
        })
        .filter(Boolean) as LocalFieldDefinition[];

      const saved = localDocumentModel.setFields(normalized);
      return res.json({ success: true, fields: saved });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ success: false, error: message });
    }
  });

  app.post("/api/local-doc-model/train", (req, res, next) => {
    const contentType = req.headers["content-type"];
    if (typeof contentType === "string" && contentType.includes("multipart/form-data")) {
      localModelUpload.array("files", 16)(req, res, (err: unknown) => {
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
      const bodyText = typeof req.body?.text === "string" ? req.body.text : "";
      const uploadedFiles = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];

      const labels: Record<string, string> = {};
      const incomingLabels = req.body?.labels;
      if (incomingLabels && typeof incomingLabels === "object") {
        for (const [key, value] of Object.entries(incomingLabels as Record<string, unknown>)) {
          if (typeof value === "string" && value.trim()) {
            labels[String(key)] = value.trim();
          }
        }
      }

      const trainingResult = localDocumentModel.train({
        text: bodyText,
        files: uploadedFiles.map((file) => ({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer
        })),
        labels
      });

      if (!bodyText.trim() && uploadedFiles.length > 0 && trainingResult.addedSamples === 0) {
        return res.status(400).json({ success: false, error: "No textual content found for training" });
      }

      if (!bodyText.trim() && uploadedFiles.length === 0) {
        return res.status(400).json({ success: false, error: "No textual content found for training" });
      }

      return res.json({
        success: true,
        message: "Local model updated",
        addedSamples: trainingResult.addedSamples,
        skippedFiles: trainingResult.skippedFiles,
        totalSamples: trainingResult.totalSamples,
        updatedAt: trainingResult.updatedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ success: false, error: message });
    }
  });

  app.post("/api/local-doc-model/typize", (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ success: false, error: "text is required" });
    }

    const requestedFieldIds = Array.isArray(req.body?.fieldIds)
      ? req.body.fieldIds.map((item: unknown) => String(item))
      : [];

    const results: LocalFieldResult[] = localDocumentModel.typize(text, requestedFieldIds);
    const state = localDocumentModel.getState();

    return res.json({
      success: true,
      model: state.model,
      extracted: results,
      fieldsUsed: results.length,
      samplesCount: state.samplesCount
    });
  });

  app.post("/api/local-doc-model/export", (req, res) => {
    try {
      const directoryPath = typeof req.body?.directoryPath === "string" ? req.body.directoryPath.trim() : "";
      if (!directoryPath) {
        return res.status(400).json({ success: false, error: "directoryPath is required" });
      }

      const exported = localDocumentModel.exportToDirectory(directoryPath);

      return res.json({
        success: true,
        message: "Local model exported",
        filePath: exported.filePath,
        fields: exported.fields,
        samples: exported.samples
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ success: false, error: message });
    }
  });

  app.post("/api/local-doc-model/import", (req, res) => {
    try {
      const directoryPath = typeof req.body?.directoryPath === "string" ? req.body.directoryPath.trim() : "";
      if (!directoryPath) {
        return res.status(400).json({ success: false, error: "directoryPath is required" });
      }

      const imported = localDocumentModel.importFromDirectory(directoryPath);

      return res.json({
        success: true,
        message: "Local model imported",
        fields: imported.fields,
        samples: imported.samples,
        updatedAt: imported.updatedAt,
        sourceFile: imported.sourceFile
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ success: false, error: message });
    }
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

      const textOnlyQuestion = buildQuestionWithFiles(normalizedQuestion, uploadedFiles);
      const multimodalQuestion = buildMultimodalContent(normalizedQuestion, uploadedFiles);
      const selectedPreset = settingsStore.models?.find((item) => item.id === settingsStore.activeModelId);
      const activeProvider = (provider || selectedPreset?.provider || settingsStore.provider || "Anthropic") as ProviderName;
      const providerQuestion: OpenAIUserContent = activeProvider === "Anthropic" ? textOnlyQuestion : multimodalQuestion;
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
      console.log('[CHAT] All validation passed. Question length:', textOnlyQuestion.length, 'Using provider:', activeProvider, 'Model:', activeModel);
      let providerCall: Promise<string>;
      switch (activeProvider) {
        case "Anthropic":
          providerCall = callAnthropic(providerQuestion, activeModel);
          break;
        case "OpenAI":
          providerCall = callOpenAI(providerQuestion, activeModel);
          break;
        case "OmniRoute":
          providerCall = callOmniRoute(providerQuestion, activeModel);
          break;
        case "Grok":
          providerCall = callGrok(providerQuestion, activeModel);
          break;
        case "Qwen":
          providerCall = callQwen(providerQuestion, activeModel);
          break;
        case "DeepSeek":
          providerCall = callDeepSeek(providerQuestion, activeModel);
          break;
        case "OpenRouter":
          if (!settingsStore.apiKey) {
            throw new Error("Model API key not configured. Please save settings.");
          }
          providerCall = callOpenAICompatibleProvider(providerQuestion, activeModel, "OpenRouter");
          break;
        case "Local Model":
          providerCall = callLocalModel(providerQuestion, activeModel);
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
  const host = options.host ?? (process.env.NODE_ENV === "development" ? "127.0.0.1" : "0.0.0.0");
  const app = createApp(options.serveStatic ?? false);

  return app.listen(port, host, () => {
    console.log(`Super Chat API running on http://${host}:${port}`);
  });
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

// Always start the server when this module is run directly
startServer();

// Prevent process from exiting
process.stdin.resume();
