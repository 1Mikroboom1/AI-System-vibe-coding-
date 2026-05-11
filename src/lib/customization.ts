export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
};

export type ProviderName = "Anthropic" | "OpenAI" | "Grok" | "Qwen" | "DeepSeek" | "OpenRouter" | "OmniRoute" | "Local Model";

export type ModelPreset = {
  id: string;
  name: string;
  provider: ProviderName;
  model: string;
};

export type DevToolsMode = "off" | "detach" | "right";

export const themeStorageKeys = {
  presets: "rag-desktop-theme-presets",
  activeId: "rag-desktop-theme-active-id",
  mode: "rag-desktop-theme-mode"
} as const;

export const devToolsStorageKey = "rag-desktop-devtools-mode";

export const modelStorageKeys = {
  activeId: "rag-desktop-active-model-id"
} as const;

export const defaultThemePresets: ThemePreset[] = [
  { id: "theme-charcoal-ivory", name: "Charcoal Ivory", primary: "#111111", secondary: "#F4EDE4" },
  { id: "theme-violet-gold", name: "Violet Gold", primary: "#5A189A", secondary: "#FFD60A" },
  { id: "theme-forest-sand", name: "Forest Sand", primary: "#023020", secondary: "#D4A373" },
  { id: "theme-scarlet-linen", name: "Scarlet Linen", primary: "#D62828", secondary: "#FFF3E0" },
  { id: "theme-mint-eclipse", name: "Mint Eclipse", primary: "#2EC4B6", secondary: "#1A1A2E" },
  { id: "theme-ruby-mist", name: "Ruby Mist", primary: "#D2042D", secondary: "#FAF9F6" },
  { id: "theme-canyon-glow", name: "Canyon Glow", primary: "#FF6F3C", secondary: "#F5EBD0" },
  { id: "theme-tangerine-marine", name: "Tangerine Marine", primary: "#EEA47F", secondary: "#00539C" },
  { id: "theme-sage-porcelain", name: "Sage Porcelain", primary: "#69A481", secondary: "#E7EDEB" },
  { id: "theme-copper-frost", name: "Copper Frost", primary: "#A0430A", secondary: "#DFE8E6" },
  { id: "theme-amber-slate", name: "Amber Slate", primary: "#FBA002", secondary: "#313B2F" },
  { id: "theme-coastal-ivory", name: "Coastal Ivory", primary: "#5C899D", secondary: "#FFFCEF" }
];

export const defaultThemeMode: "light" | "dark" = "light";

export const modelProviders: ModelPreset["provider"][] = ["Anthropic", "OpenAI", "Grok", "Qwen", "DeepSeek", "OpenRouter", "OmniRoute", "Local Model"];

export function getProviderDisplayName(provider: ModelPreset["provider"]): string {
  switch (provider) {
    case "Anthropic":
      return "Claude";
    case "OpenAI":
      return "ChatGPT";
    case "Grok":
      return "Grok";
    case "Qwen":
      return "Qwen";
    case "DeepSeek":
      return "DeepSeek";
    case "OpenRouter":
      return "OpenRouter";
    case "OmniRoute":
      return "OmniRoute";
    case "Local Model":
      return "Local Model";
  }
}

export function createCustomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeHexColor(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "#000000";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}