import { useEffect, useMemo, useState } from "react";
import { useOpenRouterModels, useRefreshOpenRouterModels, useOpenRouterFavorites } from "../../hooks/useOpenRouter";
import { useOpenRouterStore } from "../../stores/openRouterStore";
import { createCustomId, getProviderDisplayName, modelProviders, type DevToolsMode, type ModelPreset } from "../../lib/customization";
import { useOmniRouteTest } from "../../hooks/useOmniRouteTest";
import { t, type Language } from "../../lib/i18n";
import type { SupportedProvider } from "../../lib/providers";

interface SettingsPageProps {
  language: Language;
}

type ApiSettings = {
  provider?: string | null;
  model?: string | null;
  omniRouteBaseUrl?: string | null;
  activeModelId?: string | null;
  models?: ModelPreset[];
};

type ModelFormState = {
  id: string;
  name: string;
  provider: ModelPreset["provider"];
  model: string;
};

const emptyModelForm: ModelFormState = {
  id: "",
  name: "",
  provider: "Anthropic",
  model: ""
};

type ProviderSetupGuide = {
  displayName: string;
  apiKeyUrl: string;
  baseUrl: string;
  notes: string[];
};

const providerSetupGuides: Record<string, ProviderSetupGuide> = {
  "OpenRouter": {
    displayName: "OpenRouter",
    apiKeyUrl: "https://openrouter.ai/keys",
    baseUrl: "https://openrouter.ai/api/v1",
    notes: [
      "Go to OpenRouter.ai and sign up for a free account",
      "Navigate to your API Keys page to generate a new key",
      "Copy the key and paste it in the API Key field above",
      "OpenRouter provides free tier access to many models",
      "You can test connection before saving to verify the key works"
    ]
  },
  "OpenAI": {
    displayName: "OpenAI",
    apiKeyUrl: "https://platform.openai.com/account/api-keys",
    baseUrl: "https://api.openai.com/v1",
    notes: [
      "Visit OpenAI's API platform and log in with your account",
      "Go to API Keys section and create a new secret key",
      "Make sure you have credits or a payment method set up",
      "Copy the key and paste it in the API Key field above",
      "Do not share your API key with anyone"
    ]
  },
  "Anthropic": {
    displayName: "Anthropic",
    apiKeyUrl: "https://console.anthropic.com/account/keys",
    baseUrl: "https://api.anthropic.com/v1",
    notes: [
      "Go to console.anthropic.com and create an account or log in",
      "Navigate to Settings → API Keys to create a new API key",
      "Ensure you have added a valid payment method",
      "Copy your API key and paste it in the API Key field above",
      "Keep your API key confidential"
    ]
  },
  "Grok": {
    displayName: "Grok (X.AI)",
    apiKeyUrl: "https://console.x.ai",
    baseUrl: "https://api.x.ai/v1",
    notes: [
      "Visit console.x.ai and sign up for an account",
      "Go to API Keys section to create a new API key",
      "You'll need to set up billing to use the API",
      "Copy the key and paste it in the API Key field above",
      "Use the base URL: https://api.x.ai/v1"
    ]
  },
  "Qwen": {
    displayName: "Qwen (Alibaba)",
    apiKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    notes: [
      "Visit Alibaba Cloud DashScope console",
      "Create an API key in the API Key management section",
      "Set up billing with Alibaba Cloud",
      "Copy the API key and paste it in the API Key field above",
      "Use the international endpoint for better compatibility"
    ]
  },
  "DeepSeek": {
    displayName: "DeepSeek",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    baseUrl: "https://api.deepseek.com/v1",
    notes: [
      "Go to platform.deepseek.com and create an account",
      "Navigate to API Keys to generate a new API key",
      "Add a payment method to your account",
      "Copy the API key and paste it in the API Key field above",
      "DeepSeek offers competitive pricing for their models"
    ]
  },
  "OmniRoute": {
    displayName: "OmniRoute",
    apiKeyUrl: "https://omniroute.ai/keys",
    baseUrl: "http://localhost:20128/v1",
    notes: [
      "Visit omniroute.ai to create an account and get API keys",
      "Or run OmniRoute locally for development",
      "For local setup: install OmniRoute and run it on localhost:20128",
      "Set the base URL to point to your OmniRoute instance",
      "OmniRoute allows you to route requests to multiple providers"
    ]
  },
  "Local Model": {
    displayName: "Local Model",
    apiKeyUrl: "",
    baseUrl: "http://localhost:11434/v1",
    notes: [
      "Run Ollama or another OpenAI-compatible local server",
      "Popular option: Ollama (https://ollama.ai)",
      "Start Ollama and verify it's running on localhost:11434",
      "Set the base URL to your local endpoint",
      "API key is optional for local models"
    ]
  }
};

export function SettingsPage({ language }: SettingsPageProps) {
  const { result: connectionResult, isLoading: isTesting, testConnection, reset: resetConnectionTest } = useOmniRouteTest();

  const [provider, setProvider] = useState<string>("Anthropic");
  const [apiKey, setApiKey] = useState<string>("");
  const [omniRouteBaseUrl, setOmniRouteBaseUrl] = useState<string>("http://localhost:20128/v1");
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>("");
  const [modelForm, setModelForm] = useState<ModelFormState>(emptyModelForm);
  const [devToolsMode, setDevToolsMode] = useState<DevToolsMode>("off");
  const [status, setStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [freeModelDialog, setFreeModelDialog] = useState<{ show: boolean; model?: any }>({ show: false });
  const [selectedFreeModelsForBatch, setSelectedFreeModelsForBatch] = useState<Set<string>>(new Set());
  const [expandedProviderGuides, setExpandedProviderGuides] = useState<Set<string>>(new Set());

  const activeModel = useMemo(() => models.find((item) => item.id === activeModelId) ?? models[0] ?? null, [activeModelId, models]);
  const providerNeedsBaseUrl = ["OmniRoute", "Local Model", "Grok", "Qwen", "DeepSeek", "OpenRouter"].includes(provider);
  const providerRequiresApiKey = provider !== "Local Model";
  const providerBaseUrlExamples: Record<string, string> = {
    OmniRoute: "http://localhost:20128/v1",
    "Local Model": "http://localhost:11434/v1",
    Grok: "https://api.x.ai/v1",
    Qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    DeepSeek: "https://api.deepseek.com/v1",
    OpenRouter: "https://openrouter.ai/v1"
  };

  // Default base URLs for each provider
  const getProviderDefaultBaseUrl = (prov: string): string => {
    return providerBaseUrlExamples[prov] || "http://localhost:20128/v1";
  };

  const { data: openRouterModelsData, isLoading: isLoadingOpenRouterModels } = useOpenRouterModels(omniRouteBaseUrl);
  const refreshOpenRouter = useRefreshOpenRouterModels();
  const openRouterFavsQuery = useOpenRouterFavorites();
  const openRouterFavsResult = openRouterFavsQuery.useQueryGet();
  const setOpenRouterFavorites = useOpenRouterStore((s) => s.setFavorites);

  const freeModels = (((openRouterModelsData as any)?.models) ?? []).filter((m: any) => Boolean(m.free));

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: { success?: boolean; settings?: ApiSettings }) => {
        if (data?.success && data?.settings) {
          if (data.settings.provider) setProvider(data.settings.provider);
          if (data.settings.omniRouteBaseUrl) setOmniRouteBaseUrl(data.settings.omniRouteBaseUrl);
          if (Array.isArray(data.settings.models)) setModels(data.settings.models);
          if (data.settings.activeModelId) setActiveModelId(data.settings.activeModelId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const storedDevToolsMode = window.localStorage.getItem("rag-desktop-devtools-mode") as DevToolsMode | null;
    if (storedDevToolsMode === "detach" || storedDevToolsMode === "right" || storedDevToolsMode === "off") {
      setDevToolsMode(storedDevToolsMode);
    }
  }, []);

  // When provider changes, update base URL to the new provider's default if current doesn't match
  useEffect(() => {
    if (!providerNeedsBaseUrl) return;
    
    const newDefault = getProviderDefaultBaseUrl(provider);
    const currentLower = omniRouteBaseUrl.toLowerCase();
    
    // Update if:
    // 1. Current URL is empty
    // 2. Current URL is one of the known defaults (user hasn't customized)
    // 3. Current URL appears to be for a different provider
    const currentIsKnownDefault = Object.values(providerBaseUrlExamples).some(u => u.toLowerCase() === currentLower);
    const currentIsForDifferentProvider = Object.entries(providerBaseUrlExamples)
      .some(([prov, url]) => prov !== provider && currentLower.includes(url.toLowerCase().split('/')[2])); // Check hostname
    
    if (!omniRouteBaseUrl || currentIsKnownDefault || currentIsForDifferentProvider) {
      setOmniRouteBaseUrl(newDefault);
    }
  }, [provider, providerNeedsBaseUrl]);

  useEffect(() => {
    window.localStorage.setItem("rag-desktop-devtools-mode", devToolsMode);
    void window.desktop?.setDevToolsMode?.(devToolsMode);
  }, [devToolsMode]);

  useEffect(() => {
    if (!activeModelId && activeModel?.id) {
      setActiveModelId(activeModel.id);
    }
  }, [activeModel, activeModelId]);

  function showStatus(type: "saved" | "error", message: string) {
    setStatus(type);
    setStatusMessage(message);
    if (type === "saved") {
      window.setTimeout(() => setStatus(null), 2500);
    }
  }

  function toggleProviderGuide(providerName: string) {
    setExpandedProviderGuides((prev) => {
      const next = new Set(prev);
      if (next.has(providerName)) {
        next.delete(providerName);
      } else {
        next.add(providerName);
      }
      return next;
    });
  }

  async function persistSettings(nextModels = models, nextActiveModelId = activeModelId, includeApiConfig = true) {
    const selectedModel = nextModels.find((item) => item.id === nextActiveModelId) ?? nextModels[0] ?? null;
    const payload: Record<string, unknown> = {
      activeModelId: nextActiveModelId || selectedModel?.id || "",
      models: nextModels,
      model: selectedModel?.model ?? ""
    };

    if (includeApiConfig) {
      payload.provider = provider;
      payload.apiKey = apiKey;
      payload.omniRouteBaseUrl = omniRouteBaseUrl;
    }

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json();
    if (!res.ok || !body?.success) {
      throw new Error(body?.message ?? body?.error ?? "Error saving settings");
    }
    return body as { success: true; message?: string };
  }

  async function handleSaveGeneral() {
    setStatus("saving");
    setStatusMessage("");
    try {
      const result = await persistSettings(models, activeModelId, true);
      showStatus("saved", result.message ?? t("settings.settingsSaved", language));
      setApiKey("");
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : t("settings.errorSavingSettings", language));
    }
  }

  async function handleTestProvider() {
    if (providerNeedsBaseUrl && !omniRouteBaseUrl) {
      showStatus("error", t("settings.baseUrlRequired", language));
      return;
    }

    if (providerRequiresApiKey && !apiKey) {
      showStatus("error", t("settings.apiKeyRequired", language));
      return;
    }

    await testConnection({
      provider: provider as SupportedProvider,
      baseUrl: providerNeedsBaseUrl ? omniRouteBaseUrl : undefined,
      apiKey: apiKey || undefined,
      model: activeModel?.model || modelForm.model || undefined
    });
  }

  async function handleRefreshOpenRouterModels() {
    try {
      await refreshOpenRouter.mutateAsync({ baseUrl: omniRouteBaseUrl });
      showStatus('saved', t('settings.openRouterModelsRefreshed', language));
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : t('settings.refreshFailed', language));
    }
  }

  async function saveFavorite(modelId: string) {
    const current = openRouterFavsResult.data?.favorites ?? [];
    const next = Array.from(new Set([...current, modelId]));
    try {
      await openRouterFavsQuery.save(next);
      setOpenRouterFavorites(next);
      showStatus('saved', t('settings.favoriteSaved', language));
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : t('settings.saveFavoritesFailed', language));
    }
  }

  function promptFreeModelWarning(model: any) {
    setFreeModelDialog({ show: true, model });
  }

  async function confirmAddFreeModel() {
    if (!freeModelDialog.model) return;
    const model = freeModelDialog.model;
    const modelId = model.id || model.name;
    
    // Validate that model ID looks reasonable (not placeholder text)
    if (!modelId || /^(free|no|none|select|choose|placeholder)/i.test(modelId)) {
      showStatus('error', t('settings.invalidModel', language));
      setFreeModelDialog({ show: false });
      return;
    }
    
    const preset = { id: modelId + '-preset-' + Date.now(), name: model.name ?? modelId, provider: 'OpenRouter' as any, model: modelId };
    const nextModels = [...models, preset];
    setModels(nextModels);
    setActiveModelId(preset.id);
    try {
      await persistSettings(nextModels, preset.id, false);
      showStatus('saved', t('settings.freePresetSaved', language));
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : t('settings.errorSavingModel', language));
    }
    setFreeModelDialog({ show: false });
  }

  function toggleFreeModelForBatch(modelId: string) {
    const next = new Set(selectedFreeModelsForBatch);
    if (next.has(modelId)) {
      next.delete(modelId);
    } else {
      next.add(modelId);
    }
    setSelectedFreeModelsForBatch(next);
  }

  async function saveBatchFreeModels() {
    if (selectedFreeModelsForBatch.size === 0) {
      showStatus('error', t("settings.selectAtLeastOne", language));
      return;
    }

    const selectedModels = freeModels.filter((m: any) => selectedFreeModelsForBatch.has(m.id || m.name));
    
    // Validate all model IDs before saving
    const invalidModels = selectedModels.filter((m: any) => {
      const id = m.id || m.name;
      return !id || /^(free|no|none|select|choose|placeholder)/i.test(id);
    });
    
    if (invalidModels.length > 0) {
      showStatus('error', t('settings.cannotSaveInvalidModels', language).replace('{count}', invalidModels.length.toString()));
      return;
    }

    const newPresets = selectedModels.map((m: any) => ({
      id: (m.id || m.name) + '-preset-' + Date.now(),
      name: m.name ?? m.id,
      provider: 'OpenRouter' as any,
      model: m.id || m.name
    }));

    const nextModels = [...models, ...newPresets];
    setModels(nextModels);
    setActiveModelId(newPresets[0]?.id || activeModelId);
    setSelectedFreeModelsForBatch(new Set());

    try {
      await persistSettings(nextModels, newPresets[0]?.id || activeModelId, false);
      showStatus("saved", `${newPresets.length} ` + t("settings.freeModelsLabel", language));
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : t("settings.errorSavingModel", language));
    }
  }

  function resetModelForm() {
    setModelForm(emptyModelForm);
  }

  async function handleSaveModel() {
    const name = modelForm.name.trim();
    const modelValue = modelForm.model.trim();
    if (!name || !modelValue) {
      showStatus("error", t("settings.modelNameAndValueRequired", language));
      return;
    }

    const nextItem: ModelPreset = {
      id: modelForm.id || createCustomId("model"),
      name,
      provider: modelForm.provider,
      model: modelValue
    };

    const nextModels = modelForm.id
      ? models.map((item) => (item.id === modelForm.id ? nextItem : item))
      : [...models, nextItem];

    const nextActiveId = activeModelId || nextItem.id;
    setModels(nextModels);
    setActiveModelId(nextActiveId);

    try {
      setStatus("saving");
      await persistSettings(nextModels, nextActiveId, false);
      showStatus("saved", modelForm.id ? t("settings.modelUpdated", language) : t("settings.modelAdded", language));
      resetModelForm();
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : t("settings.errorSavingModel", language));
    }
  }

  async function handleDeleteModel(modelId: string) {
    const nextModels = models.filter((item) => item.id !== modelId);
    const nextActiveId = activeModelId === modelId ? (nextModels[0]?.id ?? "") : activeModelId;
    setModels(nextModels);
    setActiveModelId(nextActiveId);
    try {
      setStatus("saving");
      await persistSettings(nextModels, nextActiveId, false);
      showStatus("saved", t("settings.modelDeleted", language));
      if (activeModelId === modelId) {
        resetModelForm();
      }
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : t("settings.errorDeletingModel", language));
    }
  }

  function handleEditModel(modelItem: ModelPreset) {
    setModelForm({ ...modelItem });
  }

  return (
    <div className="py-8 space-y-6">
      <div className="app-panel rounded-2xl p-8">
        <h2 className="text-3xl font-bold mb-2 app-accent-text">{t("settings.title", language)}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.description", language)}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="app-panel rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4">{t("settings.apiConfig", language)}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="llm-provider" className="block text-sm font-medium mb-2">{t("settings.provider", language)}</label>
                <select
                  id="llm-provider"
                  name="llm-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                >
                  {modelProviders.map((item) => (
                    <option key={item} value={item}>
                      {getProviderDisplayName(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="api-key" className="block text-sm font-medium mb-2">{t("settings.apiKey", language)}</label>
                <input
                  id="api-key"
                  name="api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  placeholder={provider === "Local Model" ? t("settings.optionalLocal", language) : t("settings.enterApiKey", language)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                />
              </div>
              {providerNeedsBaseUrl && (
                <div>
                  <label htmlFor="omniroute-base-url" className="block text-sm font-medium mb-2">{t("settings.baseUrl", language)}</label>
                  <input
                    id="omniroute-base-url"
                    name="omniroute-base-url"
                    value={omniRouteBaseUrl}
                    onChange={(e) => {
                      setOmniRouteBaseUrl(e.target.value);
                      resetConnectionTest();
                    }}
                    type="text"
                    placeholder={providerBaseUrlExamples[provider] ?? "https://api.example.com/v1"}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t("settings.baseUrlHelp", language).replace("{example}", providerBaseUrlExamples[provider] ?? "https://api.example.com/v1")}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveGeneral}
                  className="flex-1 px-4 py-2 app-accent-gradient text-white rounded-lg font-semibold transition hover:opacity-90"
                >
                  {t("settings.saveModel", language)}
                </button>
                <button
                  onClick={handleTestProvider}
                  disabled={isTesting || (providerNeedsBaseUrl && !omniRouteBaseUrl) || (providerRequiresApiKey && !apiKey)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTesting ? t("settings.testing", language) : t("settings.test", language)}
                </button>
              </div>
              {connectionResult.status !== 'idle' && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  connectionResult.status === 'connected'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : connectionResult.status === 'testing'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="font-medium">{connectionResult.message}</div>
                  {connectionResult.details && (
                    <div className="mt-1 text-xs opacity-90">{connectionResult.details}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            {provider === 'OpenRouter' && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{t("settings.freeModels", language)}</h4>
                  <div className="flex items-center gap-2">
                    <button onClick={handleRefreshOpenRouterModels} className="px-3 py-1 rounded-lg border text-xs hover:bg-slate-100 dark:hover:bg-slate-700">{t("settings.refresh", language)}</button>
                  </div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">{t("settings.freeModelsDesc", language)}</div>
                <div className="grid grid-cols-1 gap-3 mb-4">
                  {isLoadingOpenRouterModels && <div className="text-sm text-slate-500">{t("settings.loadingModels", language)}</div>}
                  {!isLoadingOpenRouterModels && freeModels.length === 0 && <div className="text-sm text-slate-500">{t("settings.noFreeModels", language)}</div>}
                  {freeModels.map((m: any) => {
                    const isSelected = selectedFreeModelsForBatch.has(m.id || m.name);
                    return (
                      <div key={m.id || m.name} className={`rounded-xl p-3 border transition ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400' : 'bg-white/60 dark:bg-slate-900/30'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFreeModelForBatch(m.id || m.name)}
                            className="w-4 h-4 rounded"
                          />
                          <div>
                            <div className="font-medium">{m.name ?? m.id}</div>
                            <div className="text-xs text-slate-500">{m.description ?? ''} <span className="ml-2 inline-block px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">{t("settings.freeBadge", language)}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => promptFreeModelWarning(m)} className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs hover:bg-blue-700">{t("settings.add", language)}</button>
                          <button onClick={() => saveFavorite(m.id || m.name)} className="px-3 py-1 rounded-full border text-xs hover:bg-slate-100 dark:hover:bg-slate-700">♡</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {freeModels.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={saveBatchFreeModels}
                      disabled={selectedFreeModelsForBatch.size === 0}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {selectedFreeModelsForBatch.size > 0
                        ? t("settings.saveModelsCount", language).replace("{count}", selectedFreeModelsForBatch.size.toString())
                        : t("settings.saveModels", language)}
                    </button>
                    {selectedFreeModelsForBatch.size > 0 && (
                      <button
                        onClick={() => setSelectedFreeModelsForBatch(new Set())}
                        className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {t("settings.clear", language)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">{t("settings.savedModels", language)}</h3>
              <div className="text-xs text-slate-500 dark:text-slate-400">{models.length} {t("settings.configured", language)}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t("settings.modelName", language)}</label>
                <input
                  value={modelForm.name}
                  onChange={(e) => setModelForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Chat Sonnet"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t("settings.modelProvider", language)}</label>
                <select
                  value={modelForm.provider}
                  onChange={(e) => setModelForm((current) => ({ ...current, provider: e.target.value as ModelPreset["provider"] }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                >
                  {modelProviders.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t("settings.modelValue", language)}</label>
                <input
                  value={modelForm.model}
                  onChange={(e) => setModelForm((current) => ({ ...current, model: e.target.value }))}
                  placeholder="claude-3-5-sonnet-latest"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <button onClick={handleSaveModel} className="px-4 py-2 app-accent-gradient text-white rounded-lg font-semibold transition">
                {modelForm.id ? t("settings.updateModel", language) : t("settings.addModel", language)}
              </button>
              {modelForm.id && (
                <button onClick={resetModelForm} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">
                  {t("settings.cancelEdit", language)}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {models.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">{t("settings.noSavedModels", language)}</div>}
              {models.map((item) => (
                <div key={item.id} className={`rounded-xl p-4 border ${item.id === activeModelId ? "border-blue-500" : "border-slate-200 dark:border-slate-700"} bg-white/60 dark:bg-slate-900/30`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{getProviderDisplayName(item.provider)} · {item.model}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveModelId(item.id)} className="px-3 py-1 text-xs rounded-full bg-slate-200 dark:bg-slate-700">{t("settings.use", language)}</button>
                      <button onClick={() => handleEditModel(item)} className="px-3 py-1 text-xs rounded-full bg-blue-600 text-white" title={t("settings.edit", language)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteModel(item.id)} className="px-3 py-1 text-xs rounded-full bg-red-600 text-white" title={t("settings.delete", language)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                          <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm font-medium">{t("settings.activeModel", language)}</label>
              <select
                value={activeModelId}
                onChange={(e) => setActiveModelId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
              >
                <option value="">{t("settings.selectSavedModel", language)}</option>
                {models.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {getProviderDisplayName(item.provider)}</option>
                ))}
              </select>
              <button onClick={() => persistSettings(models, activeModelId)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" title={t("settings.saveActive", language)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zM12 19a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-11H6V5h9v3z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">{t("settings.devTools", language)}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("settings.applesImmediately", language)}</span>
            </div>
            <select
              value={devToolsMode}
              onChange={(e) => setDevToolsMode(e.target.value as DevToolsMode)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
            >
              <option value="off">{t("settings.devToolsOff", language)}</option>
              <option value="detach">{t("settings.devToolsDetach", language)}</option>
              <option value="right">{t("settings.devToolsRight", language)}</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-panel rounded-2xl p-6">
            <h3 className="font-semibold mb-4">{t("settings.setupGuide", language)}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("settings.setupGuideDesc", language)}</p>
            <div className="space-y-2">
              {Object.entries(providerSetupGuides).map(([key, guide]) => {
                const isExpanded = expandedProviderGuides.has(key);
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleProviderGuide(key)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/50 transition"
                    >
                      <span className="font-medium text-sm">
                        {t(`settings.provider.${key.toLowerCase().replace(/\s+/g, '')}`, language) || guide.displayName}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="currentColor"
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/30 space-y-3">
                        {guide.apiKeyUrl && (
                          <div>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("settings.getApiKey", language)}</p>
                            <a
                              href={guide.apiKeyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                            >
                              {guide.apiKeyUrl}
                            </a>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("settings.baseUrlLabel", language)}</p>
                          <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded block break-all">
                            {guide.baseUrl}
                          </code>
                        </div>
                        {guide.notes.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t("settings.setupSteps", language)}</p>
                            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
                              {(() => {
                                const translatedGuide = t(`settings.guide.${key.toLowerCase().replace(/\s+/g, '')}`, language);
                                const notes = translatedGuide && translatedGuide !== `settings.guide.${key.toLowerCase().replace(/\s+/g, '')}` 
                                  ? translatedGuide.split(' | ')
                                  : guide.notes;
                                return notes.map((note, idx) => (
                                  <li key={idx}>{note.trim()}</li>
                                ));
                              })()}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="app-panel rounded-2xl p-6">
            <h3 className="font-semibold mb-4">{t("settings.about", language)}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t("settings.aboutText", language)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("settings.aboutDesc", language)}</p>
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {status === 'saving' && <span>{t("settings.saving", language)}</span>}
              {status === 'saved' && <span className="text-green-600">{statusMessage || t("settings.saved", language)}</span>}
              {status === 'error' && <span className="text-red-600">{statusMessage || t("settings.error", language)}</span>}
            </div>
          </div>
        </div>
      </div>

      {freeModelDialog.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">{t("settings.freeWarning", language)}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t("settings.aboutToAdd", language).replace("{model}", freeModelDialog.model?.name ?? freeModelDialog.model?.id)}
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t("settings.freeModelsMayHave", language)}</strong>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>{t("settings.rateLimits", language)}</li>
                  <li>{t("settings.slowerResponse", language)}</li>
                  <li>{t("settings.limitedAvailability", language)}</li>
                </ul>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFreeModelDialog({ show: false })}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {t("chat.cancel", language)}
              </button>
              <button
                onClick={() => confirmAddFreeModel()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
              >
                {t("settings.confirmAddFreeModel", language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
