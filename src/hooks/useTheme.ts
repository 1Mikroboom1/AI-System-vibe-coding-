import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createCustomId,
  defaultThemeMode,
  defaultThemePresets,
  normalizeHexColor,
  safeParseJson,
  themeStorageKeys,
  type ThemePreset
} from "../lib/customization";

export function useTheme() {
  const themeState = useSyncExternalStore(subscribeThemeStore, getThemeSnapshot, getThemeSnapshot);
  const theme = themeState.mode;
  const themePresets = themeState.presets;
  const activeThemeId = themeState.activeId;

  const activeTheme = useMemo(() => {
    return themePresets.find((preset) => preset.id === activeThemeId) ?? themePresets[0] ?? defaultThemePresets[0];
  }, [activeThemeId, themePresets]);

  useEffect(() => {
    const root = document.documentElement;
    const colorTheme = activeTheme ?? defaultThemePresets[0];

    root.classList.toggle("dark", theme === "dark");
    root.dataset.themeMode = theme;
    root.dataset.themeId = colorTheme?.id ?? defaultThemePresets[0].id;
    root.style.setProperty("--app-primary", normalizeHexColor(colorTheme?.primary ?? defaultThemePresets[0].primary));
    root.style.setProperty("--app-secondary", normalizeHexColor(colorTheme?.secondary ?? defaultThemePresets[0].secondary));
    root.style.setProperty("--app-theme-name", colorTheme?.name ?? defaultThemePresets[0].name);
  }, [activeTheme, theme]);

  const setTheme = (newTheme: "light" | "dark") => {
    updateThemeStore({ mode: newTheme });
  };

  const setActiveThemeId = (themeId: string) => {
    updateThemeStore({ activeId: themeId });
  };

  const upsertThemePreset = (preset: Omit<ThemePreset, "id"> & { id?: string }) => {
    const normalized: ThemePreset = {
      id: preset.id || createCustomId("theme"),
      name: preset.name.trim() || "Custom Theme",
      primary: normalizeHexColor(preset.primary),
      secondary: normalizeHexColor(preset.secondary)
    };

    const nextPresets = themePresets.some((item) => item.id === normalized.id)
      ? themePresets.map((item) => (item.id === normalized.id ? normalized : item))
      : [...themePresets, normalized];

    updateThemeStore({ presets: nextPresets, activeId: normalized.id });
    return normalized;
  };

  const deleteThemePreset = (themeId: string) => {
    const next = themePresets.filter((item) => item.id !== themeId);
    const fallbackId = next[0]?.id || defaultThemePresets[0]?.id || "";
    updateThemeStore({
      presets: next.length > 0 ? next : defaultThemePresets,
      activeId: themeId === activeThemeId ? fallbackId : activeThemeId
    });
  };

  return {
    theme,
    setTheme,
    themePresets,
    activeThemeId,
    setActiveThemeId,
    upsertThemePreset,
    deleteThemePreset
  };
}

type ThemeStoreSnapshot = {
  mode: "light" | "dark";
  presets: ThemePreset[];
  activeId: string;
};

const themeStoreListeners = new Set<() => void>();
let themeStoreSnapshot = readThemeStore();

function readThemeStore(): ThemeStoreSnapshot {
  if (typeof window === "undefined") {
    return {
      mode: defaultThemeMode,
      presets: defaultThemePresets,
      activeId: defaultThemePresets[0]?.id ?? ""
    };
  }

  const mode = window.localStorage.getItem(themeStorageKeys.mode) === "dark" ? "dark" : defaultThemeMode;
  const presets = safeParseJson<ThemePreset[]>(window.localStorage.getItem(themeStorageKeys.presets), defaultThemePresets);
  const activeId = window.localStorage.getItem(themeStorageKeys.activeId) || presets[0]?.id || defaultThemePresets[0]?.id || "";
  return {
    mode,
    presets: presets.length > 0 ? presets : defaultThemePresets,
    activeId
  };
}

function getThemeSnapshot(): ThemeStoreSnapshot {
  return themeStoreSnapshot;
}

function subscribeThemeStore(callback: () => void) {
  themeStoreListeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKeys.mode || event.key === themeStorageKeys.presets || event.key === themeStorageKeys.activeId) {
      themeStoreSnapshot = readThemeStore();
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  return () => {
    themeStoreListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function updateThemeStore(partial: Partial<ThemeStoreSnapshot>) {
  if (typeof window === "undefined") return;

  const previousActiveId = themeStoreSnapshot.activeId;
  const next = { ...themeStoreSnapshot, ...partial };
  themeStoreSnapshot = {
    mode: next.mode,
    presets: next.presets.length > 0 ? next.presets : defaultThemePresets,
    activeId: next.activeId || next.presets[0]?.id || defaultThemePresets[0]?.id || ""
  };
  window.localStorage.setItem(themeStorageKeys.mode, next.mode);
  window.localStorage.setItem(themeStorageKeys.presets, JSON.stringify(themeStoreSnapshot.presets));
  window.localStorage.setItem(themeStorageKeys.activeId, themeStoreSnapshot.activeId);

  const activeTheme = themeStoreSnapshot.presets.find((preset) => preset.id === themeStoreSnapshot.activeId) ?? themeStoreSnapshot.presets[0] ?? defaultThemePresets[0];
  const root = document.documentElement;
  if (previousActiveId !== themeStoreSnapshot.activeId) {
    // Add a temporary class to enable smooth theme-variable transitions only for theme-scheme changes.
    try {
      root.classList.add('theme-transition');
      root.classList.add('theme-cover');
      window.setTimeout(() => root.classList.remove('theme-transition'), 400);
      window.setTimeout(() => root.classList.remove('theme-cover'), 420);
    } catch {
      // ignore
    }
  }
  root.classList.toggle("dark", themeStoreSnapshot.mode === "dark");
  root.dataset.themeMode = themeStoreSnapshot.mode;
  root.dataset.themeId = activeTheme?.id ?? defaultThemePresets[0].id;
  root.style.setProperty("--app-primary", normalizeHexColor(activeTheme?.primary ?? defaultThemePresets[0].primary));
  root.style.setProperty("--app-secondary", normalizeHexColor(activeTheme?.secondary ?? defaultThemePresets[0].secondary));
  root.style.setProperty("--app-theme-name", activeTheme?.name ?? defaultThemePresets[0].name);

  themeStoreListeners.forEach((listener) => listener());
}
