import { useEffect, useMemo, useState } from "react";
import { useOpenRouterModels, useRefreshOpenRouterModels, useOpenRouterFavorites } from "../../hooks/useOpenRouter";
import { useOpenRouterStore } from "../../stores/openRouterStore";
import { createCustomId, getProviderDisplayName, modelProviders, normalizeHexColor, type DevToolsMode, type ModelPreset } from "../../lib/customization";
import { useTheme } from "../../hooks/useTheme";
import { useOmniRouteTest } from "../../hooks/useOmniRouteTest";
import type { SupportedProvider } from "../../lib/providers";

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

type ThemeFormState = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
};

const emptyModelForm: ModelFormState = {
  id: "",
  name: "",
  provider: "Anthropic",
  model: ""
};

const emptyThemeForm: ThemeFormState = {
  id: "",
  name: "",
  primary: "#2563eb",
  secondary: "#38bdf8"
};

export function SettingsPage() {
  const { themePresets, activeThemeId, setActiveThemeId, upsertThemePreset, deleteThemePreset } = useTheme();
  const { result: connectionResult, isLoading: isTesting, testConnection, reset: resetConnectionTest } = useOmniRouteTest();

  const [provider, setProvider] = useState<string>("Anthropic");
  const [apiKey, setApiKey] = useState<string>("");
  const [omniRouteBaseUrl, setOmniRouteBaseUrl] = useState<string>("http://localhost:20128/v1");
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>("");
  const [modelForm, setModelForm] = useState<ModelFormState>(emptyModelForm);
  const [themeForm, setThemeForm] = useState<ThemeFormState>(emptyThemeForm);
  const [devToolsMode, setDevToolsMode] = useState<DevToolsMode>("off");
  const [status, setStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [freeModelDialog, setFreeModelDialog] = useState<{ show: boolean; model?: any }>({ show: false });
  const [selectedFreeModelsForBatch, setSelectedFreeModelsForBatch] = useState<Set<string>>(new Set());
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [pickerMode, setPickerMode] = useState<'tiles' | 'create'>('tiles');

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
    fetch("http://localhost:5000/api/settings")
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

    const res = await fetch("http://localhost:5000/api/settings", {
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
      showStatus("saved", result.message ?? "Settings saved");
      setApiKey("");
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Network error while saving settings");
    }
  }

  async function handleTestProvider() {
    if (providerNeedsBaseUrl && !omniRouteBaseUrl) {
      showStatus("error", "Base URL is required to test connection");
      return;
    }

    if (providerRequiresApiKey && !apiKey) {
      showStatus("error", "API Key is required to test connection");
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
      showStatus('saved', 'OpenRouter models refreshed');
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Refresh failed');
    }
  }

  async function saveFavorite(modelId: string) {
    const current = openRouterFavsResult.data?.favorites ?? [];
    const next = Array.from(new Set([...current, modelId]));
    try {
      await openRouterFavsQuery.save(next);
      setOpenRouterFavorites(next);
      showStatus('saved', 'Favorite saved');
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Save favorites failed');
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
      showStatus('error', 'Invalid model identifier. Please select a valid free model.');
      setFreeModelDialog({ show: false });
      return;
    }
    
    const preset = { id: modelId + '-preset-' + Date.now(), name: model.name ?? modelId, provider: 'OpenRouter' as any, model: modelId };
    const nextModels = [...models, preset];
    setModels(nextModels);
    setActiveModelId(preset.id);
    try {
      await persistSettings(nextModels, preset.id, false);
      showStatus('saved', 'Free model preset saved');
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Error saving model');
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
      showStatus('error', 'Select at least one model');
      return;
    }

    const selectedModels = freeModels.filter((m: any) => selectedFreeModelsForBatch.has(m.id || m.name));
    
    // Validate all model IDs before saving
    const invalidModels = selectedModels.filter((m: any) => {
      const id = m.id || m.name;
      return !id || /^(free|no|none|select|choose|placeholder)/i.test(id);
    });
    
    if (invalidModels.length > 0) {
      showStatus('error', `Cannot save ${invalidModels.length} model(s) with invalid identifiers. Please refresh the models list.`);
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
      showStatus('saved', `${newPresets.length} free model presets saved`);
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Error saving models');
    }
  }

  function resetModelForm() {
    setModelForm(emptyModelForm);
  }

  async function handleSaveModel() {
    const name = modelForm.name.trim();
    const modelValue = modelForm.model.trim();
    if (!name || !modelValue) {
      showStatus("error", "Model name and value are required");
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
      showStatus("saved", modelForm.id ? "Model updated" : "Model added");
      resetModelForm();
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Error saving model");
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
      showStatus("saved", "Model deleted");
      if (activeModelId === modelId) {
        resetModelForm();
      }
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Error deleting model");
    }
  }

  function handleEditModel(modelItem: ModelPreset) {
    setModelForm({ ...modelItem });
  }

  function handleAddTheme() {
    const saved = upsertThemePreset({
      id: themeForm.id || undefined,
      name: themeForm.name,
      primary: normalizeHexColor(themeForm.primary),
      secondary: normalizeHexColor(themeForm.secondary)
    });
    setThemeForm(emptyThemeForm);
    setActiveThemeId(saved.id);
    showStatus("saved", themeForm.id ? "Theme updated" : "Theme saved");
  }

  function handleEditTheme(themeId: string) {
    const item = themePresets.find((preset) => preset.id === themeId);
    if (!item) return;
    setThemeForm(item);
    setPickerMode('create');
  }

  function handleDeleteTheme(themeId: string) {
    try {
      deleteThemePreset(themeId);
      showStatus('saved', 'Theme deleted');
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Error deleting theme');
    }
  }

  return (
    <div className="py-8 space-y-6">
      <div className="app-panel rounded-2xl p-8">
        <h2 className="text-3xl font-bold mb-2 app-accent-text">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage models, color themes, and debugging tools.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="app-panel rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4">API Configuration</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="llm-provider" className="block text-sm font-medium mb-2">LLM Provider</label>
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
                <label htmlFor="api-key" className="block text-sm font-medium mb-2">API Key</label>
                <input
                  id="api-key"
                  name="api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  placeholder={provider === "Local Model" ? "Optional for local endpoints" : "Enter your API key"}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                />
              </div>
              {providerNeedsBaseUrl && (
                <div>
                  <label htmlFor="omniroute-base-url" className="block text-sm font-medium mb-2">Provider Base URL</label>
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
                    Use the exact API base URL for OmniRoute, a local OpenAI-compatible endpoint, or a direct OpenAI-compatible provider. Examples: {providerBaseUrlExamples[provider] ?? "https://api.example.com/v1"}.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveGeneral}
                  className="flex-1 px-4 py-2 app-accent-gradient text-white rounded-lg font-semibold transition hover:opacity-90"
                >
                  Save API Settings
                </button>
                <button
                  onClick={handleTestProvider}
                  disabled={isTesting || (providerNeedsBaseUrl && !omniRouteBaseUrl) || (providerRequiresApiKey && !apiKey)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
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
                  <h4 className="font-semibold">OpenRouter — Free Models</h4>
                  <div className="flex items-center gap-2">
                    <button onClick={handleRefreshOpenRouterModels} className="px-3 py-1 rounded-lg border text-xs hover:bg-slate-100 dark:hover:bg-slate-700">Refresh</button>
                  </div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">Select and save multiple free models as presets. Note: free models may have usage limits and slower response times.</div>
                <div className="grid grid-cols-1 gap-3 mb-4">
                  {isLoadingOpenRouterModels && <div className="text-sm text-slate-500">Loading models...</div>}
                  {!isLoadingOpenRouterModels && freeModels.length === 0 && <div className="text-sm text-slate-500">No free models found.</div>}
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
                            <div className="text-xs text-slate-500">{m.description ?? ''} <span className="ml-2 inline-block px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">Free</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => promptFreeModelWarning(m)} className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs hover:bg-blue-700">Add</button>
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
                      Save {selectedFreeModelsForBatch.size > 0 ? `${selectedFreeModelsForBatch.size} Model${selectedFreeModelsForBatch.size !== 1 ? 's' : ''}` : 'Models'}
                    </button>
                    {selectedFreeModelsForBatch.size > 0 && (
                      <button
                        onClick={() => setSelectedFreeModelsForBatch(new Set())}
                        className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">Saved Models</h3>
              <div className="text-xs text-slate-500 dark:text-slate-400">{models.length} configured</div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Model Name</label>
                <input
                  value={modelForm.name}
                  onChange={(e) => setModelForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Chat Sonnet"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Model Provider</label>
                <select
                  value={modelForm.provider}
                  onChange={(e) => setModelForm((current) => ({ ...current, provider: e.target.value as ModelPreset["provider"] }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                >
                  {modelProviders.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Model Value</label>
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
                {modelForm.id ? "Update Model" : "Add Model"}
              </button>
              {modelForm.id && (
                <button onClick={resetModelForm} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="space-y-3">
              {models.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">No saved models yet. Add one above to make it available in Chat.</div>}
              {models.map((item) => (
                <div key={item.id} className={`rounded-xl p-4 border ${item.id === activeModelId ? "border-blue-500" : "border-slate-200 dark:border-slate-700"} bg-white/60 dark:bg-slate-900/30`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{getProviderDisplayName(item.provider)} · {item.model}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveModelId(item.id)} className="px-3 py-1 text-xs rounded-full bg-slate-200 dark:bg-slate-700">Use</button>
                      <button onClick={() => handleEditModel(item)} className="px-3 py-1 text-xs rounded-full bg-blue-600 text-white" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteModel(item.id)} className="px-3 py-1 text-xs rounded-full bg-red-600 text-white" title="Delete">
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
              <label className="text-sm font-medium">Active Model</label>
              <select
                value={activeModelId}
                onChange={(e) => setActiveModelId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
              >
                <option value="">Select a saved model</option>
                {models.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {getProviderDisplayName(item.provider)}</option>
                ))}
              </select>
              <button onClick={() => persistSettings(models, activeModelId)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm" title="Save Active">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zM12 19a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-11H6V5h9v3z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">DevTools Mode</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">Applies immediately in Electron</span>
            </div>
            <select
              value={devToolsMode}
              onChange={(e) => setDevToolsMode(e.target.value as DevToolsMode)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
            >
              <option value="off">Off</option>
              <option value="detach">Detached window</option>
              <option value="right">Docked to right</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-panel rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">Theme Presets</h3>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">Active: {themePresets.find((item) => item.id === activeThemeId)?.name ?? "Default"}</div>
                <button onClick={() => setShowThemePicker(true)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm" title="Open theme picker">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 10v-8h8v8h-8z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="text-sm text-slate-500 dark:text-slate-400">Manage themes via the Theme Picker (open it with the button on the right).</div>
          </div>

          <div className="app-panel rounded-2xl p-6">
            <h3 className="font-semibold mb-4">About</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Super Chat v1.0.0</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Enterprise retrieval-augmented generation system built with React, Express, and Electron.</p>
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {status === 'saving' && <span>Saving...</span>}
              {status === 'saved' && <span className="text-green-600">{statusMessage || 'Saved'}</span>}
              {status === 'error' && <span className="text-red-600">{statusMessage || 'Error saving'}</span>}
            </div>
          </div>
        </div>
      </div>

      {freeModelDialog.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Free Model Warning</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              You are about to add <strong>{freeModelDialog.model?.name ?? freeModelDialog.model?.id}</strong> as a preset.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Free models may have:</strong>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Rate limits and usage caps</li>
                  <li>Slower response times</li>
                  <li>Limited availability</li>
                </ul>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFreeModelDialog({ show: false })}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmAddFreeModel()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showThemePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-3xl w-full mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Theme Picker</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowThemePicker(false)} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700" title="Close">Close</button>
              </div>
            </div>

            {pickerMode === 'tiles' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <div
                  onClick={() => setPickerMode('create')}
                  role="button"
                  tabIndex={0}
                  className={`rounded-lg p-4 text-center border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/30 hover:scale-105 transition-transform duration-200 ease-in-out flex items-center justify-center`}
                  title="Create custom theme"
                >
                  <div className="text-3xl font-bold text-slate-400">+</div>
                </div>

                  {themePresets.map((item) => (
                    <div key={item.id} className={`relative rounded-lg p-4 text-left border ${item.id === activeThemeId ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'} bg-white/80 dark:bg-slate-900/30 hover:scale-105 transition-transform duration-200 ease-in-out flex flex-col justify-between`}>
                      <div
                        onClick={() => {
                          setActiveThemeId(item.id);
                          setShowThemePicker(false);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-center justify-between mb-3 min-h-[28px]">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.id === activeThemeId && <div className="text-xs text-blue-600">Active</div>}
                        </div>
                        <div className="flex overflow-hidden rounded-lg h-8">
                          <div className="flex-1" style={{ background: item.primary }} />
                          <div className="flex-1" style={{ background: item.secondary }} />
                        </div>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTheme(item.id);
                        }}
                        title="Edit"
                        className="p-1 rounded bg-white/90 dark:bg-slate-800/60"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTheme(item.id); }}
                        title="Delete"
                        className="p-1 rounded bg-white/90 dark:bg-slate-800/60"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                          <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <input
                    value={themeForm.name}
                    onChange={(e) => setThemeForm((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Theme name"
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={themeForm.primary}
                      onChange={(e) => setThemeForm((current) => ({ ...current, primary: e.target.value }))}
                      className="h-11 w-14 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70"
                    />
                    <input
                      value={themeForm.primary}
                      onChange={(e) => setThemeForm((current) => ({ ...current, primary: e.target.value }))}
                      placeholder="#111111"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-2 items-center">
                    <input
                      type="color"
                      value={themeForm.secondary}
                      onChange={(e) => setThemeForm((current) => ({ ...current, secondary: e.target.value }))}
                      className="h-11 w-14 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70"
                    />
                    <input
                      value={themeForm.secondary}
                      onChange={(e) => setThemeForm((current) => ({ ...current, secondary: e.target.value }))}
                      placeholder="#F4EDE4"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => {
                      handleAddTheme();
                      setPickerMode('tiles');
                      setShowThemePicker(false);
                    }}
                    className="px-4 py-2 app-accent-gradient text-white rounded-lg font-semibold transition"
                  >
                    Save Theme
                  </button>
                  <button
                    onClick={() => {
                      setThemeForm(emptyThemeForm);
                      setPickerMode('tiles');
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
