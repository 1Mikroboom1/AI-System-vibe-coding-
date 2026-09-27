/**
 * Provider Types and OmniRoute Integration
 * Handles connection to OmniRoute gateway for multi-provider AI access
 */
/**
 * Provider Types and OmniRoute Integration
 * Handles connection to OmniRoute gateway for multi-provider AI access
 */

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isLocal: boolean;
}

export interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: OpenAIMessageContent }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export type OpenAIMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export type OpenAIMessageContent = string | OpenAIMessageContentPart[];

export interface OpenAIChatResponse {
  choices?: Array<{
    message?: { role: string; content: string };
    delta?: { content?: string };
  }>;
  error?: { message: string };
}

export type SupportedProvider = "Anthropic" | "OmniRoute" | "OpenAI" | "Grok" | "Qwen" | "DeepSeek" | "OpenRouter" | "Local Model";

export type ProviderConnectionResult = {
  status: "connected" | "error" | "unreachable";
  message: string;
  details?: string;
};

// OpenRouter models cache (simple in-memory cache)
let _openRouterModelsCache: { fetchedAt: number; baseUrl: string; models: any[] } | null = null;

export async function fetchOpenRouterModels(baseUrl: string, apiKey?: string): Promise<any[]> {
  const normalized = normalizeBaseUrl(baseUrl) || baseUrl;
  const now = Date.now();

  if (_openRouterModelsCache && _openRouterModelsCache.baseUrl === normalized && now - _openRouterModelsCache.fetchedAt < 1000 * 60 * 5) {
    return _openRouterModelsCache.models;
  }

  const candidates = [
    `${normalized}/models`,
    `${normalized}/v1/models`,
    `${normalized}/api/v1/models`,
    `${normalized}/models/list`,
    `${normalized}/v1/models/list`
  ];

  const headers = buildOpenAICompatibleHeaders(apiKey);
  headers["Accept"] = headers["Accept"] || "application/json";
  headers["User-Agent"] = headers["User-Agent"] || "RAG-Desktop/1.0";
  headers["HTTP-Referer"] = "http://localhost:1420";
  headers["X-OpenRouter-Title"] = "Kiro AI Desktop";

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, { method: "GET", headers });
      const text = await res.text();
      if (!res.ok) continue;
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        continue;
      }

      // Attempt to normalize various model list shapes
      const models: any[] = json?.models ?? json?.data ?? (Array.isArray(json) ? json : []);
      if (!Array.isArray(models) || models.length === 0) continue;

      _openRouterModelsCache = { fetchedAt: now, baseUrl: normalized, models };
      return models;
    } catch {
      // try next candidate
    }
  }

  throw new Error("Unable to fetch OpenRouter models from base URL");
}

const defaultCompatibleBaseUrls: Partial<Record<SupportedProvider, string>> = {
  OmniRoute: "http://localhost:20128/v1",
  Grok: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
  Qwen: process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  DeepSeek: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  OpenRouter: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/v1",
  "Local Model": "http://localhost:11434/v1"
};

export function getDefaultCompatibleBaseUrl(provider: SupportedProvider): string | undefined {
  return defaultCompatibleBaseUrls[provider];
}

function buildOpenAICompatibleUrl(baseUrl: string): string {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedUrl) {
    throw new Error("Base URL is empty or invalid");
  }
  return `${normalizedUrl}/chat/completions`;
}

function extractOpenAIContent(responseText: string): string {
  const data = JSON.parse(responseText) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Provider returned empty message content");
  }
  return content;
}

function buildOpenAICompatibleHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "RAG-Desktop/1.0"
  };

  const normalizedKey = normalizeApiKey(apiKey);
  if (normalizedKey) {
    headers.Authorization = `Bearer ${normalizedKey}`;
  }

  return headers;
}

/**
 * Sends a chat message through any OpenAI-compatible endpoint
 * Implements strict OpenAI-compatible format for the API call
 */
export async function sendOpenAICompatibleMessage(
  baseUrl: string,
  apiKey: string | undefined,
  request: OpenAIChatRequest
): Promise<string> {
  const url = buildOpenAICompatibleUrl(baseUrl);
  const headers = buildOpenAICompatibleHeaders(apiKey);

  try {
    // DeepSeek supports OpenAI-compatible chat completions but also accepts
    // additional DeepSeek-specific options such as `thinking` and `reasoning_effort`.
    // Detect DeepSeek by hostname present in the baseUrl passed to this helper
    const lowerUrl = url.toLowerCase();
    const isDeepSeek = lowerUrl.includes("deepseek");
    const isOpenRouter = lowerUrl.includes("openrouter") || lowerUrl.includes("openrouter.ai") || lowerUrl.includes("openrouter.ai/api");

    const bodyPayload: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens || 512,
      temperature: request.temperature || 0.7,
      stream: request.stream || false
    };

    if (isDeepSeek) {
      // Enable DeepSeek 'thinking' mode by default and prefer higher reasoning effort.
      // These can be customized later via settings or model presets.
      // See https://api-docs.deepseek.com/ for details.
      (bodyPayload as any).thinking = { type: "enabled" };
      (bodyPayload as any).reasoning_effort = "high";
    }

    // Validate and map model identifiers - prevent invalid/placeholder model names
    const incomingModel = typeof request.model === "string" ? request.model.trim() : "";
    
    // Map UI-friendly labels to sensible defaults for OpenRouter
    if (isOpenRouter) {
      const defaultOpenRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-chat-latest";
      // If incomingModel looks like a UI label or a local model name (e.g. "mistral-7b", "llama-2-70b-chat")
      // map it to a known OpenRouter model id. OpenRouter model ids generally contain a provider prefix
      // (for example "openrouter/gpt-4o-mini"). If we get a plain token without a slash, fallback to default.
      const looksLikeOpenRouterId = typeof incomingModel === 'string' && incomingModel.includes('/');
      const isPlaceholder = !incomingModel || /^free/i.test(incomingModel) || /free models?/i.test(incomingModel) || /^(no|none|select|choose|placeholder)/i.test(incomingModel);

      if (isPlaceholder || !looksLikeOpenRouterId) {
        console.warn('[PROVIDERS] OpenRouter: mapping incoming model', incomingModel, '->', defaultOpenRouterModel);
        (bodyPayload as any).model = defaultOpenRouterModel;
      } else {
        (bodyPayload as any).model = incomingModel;
      }
    } else if (!isDeepSeek && !incomingModel) {
      // For other providers, use a sensible default if model is empty
      (bodyPayload as any).model = "gpt-4o-mini";
    } else if (!isDeepSeek) {
      (bodyPayload as any).model = incomingModel;
    }

    // Attach OpenRouter-specific required headers when calling OpenRouter
    if (isOpenRouter) {
      headers["HTTP-Referer"] = "http://localhost:1420";
      headers["X-OpenRouter-Title"] = "Kiro AI Desktop";
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = responseText;
      try {
        const json = JSON.parse(responseText) as { error?: { message?: string } };
        if (json?.error?.message) {
          errorMessage = json.error.message;
        }
      } catch {
        // Keep original text if not JSON
      }
      throw new Error(`OpenAI-compatible endpoint error ${response.status}: ${errorMessage}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`OpenAI-compatible endpoint returned non-JSON response. Check that Base URL is correct. Got: ${contentType}`);
    }

    return extractOpenAIContent(responseText);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send message through OpenAI-compatible endpoint: ${String(error)}`);
  }
}

/**
 * Backwards-compatible alias for OmniRoute and other OpenAI-compatible gateways.
 */
export async function sendMessage(
  baseUrl: string,
  apiKey: string,
  request: OpenAIChatRequest
): Promise<string> {
  return sendOpenAICompatibleMessage(baseUrl, apiKey, request);
}

export async function sendOpenAIMessage(
  apiKey: string,
  request: OpenAIChatRequest
): Promise<string> {
  return sendOpenAICompatibleMessage("https://api.openai.com/v1", apiKey, request);
}

export async function sendAnthropicMessage(
  apiKey: string,
  request: OpenAIChatRequest
): Promise<string> {
  const systemPrompt = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n")
    .trim();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "messages-2023-12-15"
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.max_tokens || 512,
      temperature: request.temperature || 0.7,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: request.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: typeof message.content === "string"
            ? message.content
            : message.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n")
        }))
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    let providerMessage = responseText;
    try {
      const parsed = JSON.parse(responseText) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        providerMessage = parsed.error.message;
      }
    } catch {
      // keep original text when provider payload is not JSON
    }
    throw new Error(`Anthropic API error ${response.status}: ${providerMessage}`);
  }

  const payload = JSON.parse(responseText) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.map((part) => (part.type === "text" ? part.text ?? "" : "")).join("").trim();
  if (!text) {
    throw new Error("Anthropic returned an empty response.");
  }

  return text;
}

/**
 * Tests a provider connection and returns detailed status information for troubleshooting
 */
export async function testProviderConnection(
  provider: SupportedProvider,
  options: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  }
): Promise<ProviderConnectionResult> {
  const normalizedKey = normalizeApiKey(options.apiKey);
  const rawModel = options.model?.trim();
  
  // Validate model - reject placeholder/invalid names
  const isInvalidModel = !rawModel || /^(free|no|none|select|choose|placeholder|models?|free models?|openrouter)/i.test(rawModel);
  
  // Use provider-specific default if model is invalid or missing
  let model: string;
  if (isInvalidModel) {
    switch (provider) {
      case "Anthropic":
        model = "claude-3-5-sonnet-latest";
        break;
      case "OpenRouter":
        model = "openai/gpt-chat-latest";
        break;
      case "DeepSeek":
        model = "deepseek-chat";
        break;
      case "Grok":
        model = "grok-beta";
        break;
      case "Qwen":
        model = "qwen-plus";
        break;
      case "Local Model":
      case "OmniRoute":
        model = "gpt-4o-mini";
        break;
      default:
        model = "gpt-4o-mini";
    }
  } else {
    model = rawModel;
  }
  
  const testRequest: OpenAIChatRequest = {
    model,
    messages: [
      {
        role: "user",
        content: "ping"
      }
    ],
    max_tokens: 10
  };

  if (provider === "Anthropic") {
    if (!normalizedKey) {
      return {
        status: "error",
        message: "API Key is empty or invalid"
      };
    }

    try {
      await sendAnthropicMessage(normalizedKey, testRequest);
      return {
        status: "connected",
        message: "Successfully connected to Anthropic"
      };
    } catch (error) {
      return categorizeProviderConnectionError(error, "Anthropic", "https://api.anthropic.com/v1/messages");
    }
  }

  if (provider === "OpenAI") {
    if (!normalizedKey) {
      return {
        status: "error",
        message: "API Key is empty or invalid"
      };
    }

    try {
      await sendOpenAIMessage(normalizedKey, testRequest);
      return {
        status: "connected",
        message: "Successfully connected to OpenAI"
      };
    } catch (error) {
      return categorizeProviderConnectionError(error, "OpenAI", "https://api.openai.com/v1/chat/completions");
    }
  }

  const normalizedUrl = normalizeBaseUrl(options.baseUrl ?? getDefaultCompatibleBaseUrl(provider));

  if (!normalizedUrl) {
    return {
      status: "error",
      message: "Base URL is empty or invalid"
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    return {
      status: "error",
      message: `Invalid Base URL format: ${normalizedUrl}`,
      details: "Must be a valid URL like http://localhost:20128/v1"
    };
  }

  try {
    await resolveDns(parsedUrl.hostname);
  } catch (error) {
    const dnsError = error instanceof Error ? error.message : String(error);
    return {
      status: "unreachable",
      message: `Cannot resolve hostname: ${parsedUrl.hostname}`,
      details: `DNS error: ${dnsError}. Make sure the provider endpoint is running and the Base URL is correct.`
    };
  }

  if (provider !== "Local Model" && !normalizedKey) {
    return {
      status: "error",
      message: "API Key is empty or invalid"
    };
  }

  try {
    await sendOpenAICompatibleMessage(normalizedUrl, normalizedKey, testRequest);
    return {
      status: "connected",
      message: `Successfully connected to ${provider}`
    };
  } catch (error) {
    return categorizeProviderConnectionError(error, provider, normalizedUrl);
  }
}

/**
 * Backwards-compatible OmniRoute test wrapper.
 */
export async function testOmniRouteConnection(
  baseUrl: string,
  apiKey: string
): Promise<ProviderConnectionResult> {
  return testProviderConnection("OmniRoute", { baseUrl, apiKey });
}

function categorizeProviderConnectionError(
  error: unknown,
  provider: SupportedProvider,
  normalizedUrl: string
): ProviderConnectionResult {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
    return {
      status: "error",
      message: "Authentication failed - API Key is invalid",
      details: provider === "Anthropic"
        ? "Check that the Anthropic API Key is correct in Settings"
        : "Check that the API Key is correct in Settings"
    };
  }

  if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
    // If the provider returned an HTML page (common for gateway blocks or WAF),
    // surface a clearer troubleshooting hint including request id when present.
    const isHtml = /<\s*html|<!DOCTYPE/i.test(errorMessage);
    const requestIdMatch = /Request_id:\s*([A-Za-z0-9\-]+)/i.exec(errorMessage) || /Request-Id:\s*([A-Za-z0-9\-]+)/i.exec(errorMessage);
    const requestId = requestIdMatch ? requestIdMatch[1] : undefined;

    return {
      status: "error",
      message: `Access forbidden - Check ${provider} configuration`,
      details: isHtml
        ? `Provider returned HTML 403 (possible IP block, WAF, or insufficient permissions).${requestId ? ` Request id: ${requestId}.` : ""} Check API key, account/model access, or contact provider support.`
        : errorMessage
    };
  }

  if (errorMessage.includes("404")) {
    return {
      status: "error",
      message: "Endpoint not found",
      details: `Check the provider URL. Got: ${normalizedUrl}`
    };
  }

  if (/Free models is not a valid model ID/i.test(errorMessage) || /is not a valid model id/i.test(errorMessage)) {
    return {
      status: "error",
      message: "Invalid model identifier",
      details: "The model id appears invalid for this provider. For OpenRouter try a model like 'openai/gpt-chat-latest' or set OPENROUTER_MODEL in env."
    };
  }

  if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
    return {
      status: "unreachable",
      message: `Cannot connect to ${provider} endpoint`,
      details: `Is the service running on ${normalizedUrl}?`
    };
  }

  if (errorMessage.includes("No credentials") || errorMessage.includes("provider")) {
    return {
      status: "error",
      message: provider === "OmniRoute" ? "OmniRoute missing upstream credentials" : `${provider} rejected the request`,
      details:
        provider === "OmniRoute"
          ? "OmniRoute received the request but cannot access the configured provider. Configure providers in OmniRoute dashboard."
          : "Check the API key, model name, and base URL for this provider."
    };
  }

  return {
    status: "error",
    message: `Connection test failed: ${errorMessage}`,
    details: "Check Base URL and API Key in Settings"
  };
}

export function normalizeBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/^['"]+|['"]+$/g, "");
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

/**
 * Normalizes API key - removes quotes and trims whitespace
 */
export function normalizeApiKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/^['"]+|['"]+$/g, "");
  return trimmed || undefined;
}

/**
 * DNS resolution with timeout and proper error handling
 * Supports both localhost and 127.0.0.1
 */
async function resolveDns(hostname: string): Promise<string> {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return hostname;
  }

  try {
    const { lookup } = await import("dns/promises");
    const result = await lookup(hostname);
    return result.address;
  } catch (error) {
    throw new Error(`DNS lookup failed for ${hostname}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates that a URL is reachable (basic connectivity test)
 */
export async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/**
 * Extracts port from URL, defaults to 80 for http and 443 for https
 */
export function getPortFromUrl(url: string): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      return parseInt(parsed.port, 10);
    }
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return 80;
  }
}
