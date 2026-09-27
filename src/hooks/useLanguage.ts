import { useEffect, useSyncExternalStore } from "react";
import { Language } from "../lib/i18n";

const LANGUAGE_KEY = "rag-language";

const allowedLanguages: Language[] = ["en", "ru", "es", "fr", "de", "zh", "ja"];
const listeners = new Set<() => void>();

function isLanguage(value: string | null): value is Language {
  return value !== null && allowedLanguages.includes(value as Language);
}

function getLanguageSnapshot(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_KEY);
  return isLanguage(saved) ? saved : "en";
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyLanguageChange() {
  listeners.forEach((listener) => listener());
}

export function useLanguage(): { language: Language; setLanguage: (lang: Language) => void } {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, () => "en") as Language;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    window.localStorage.setItem(LANGUAGE_KEY, lang);
    notifyLanguageChange();
  };

  return { language, setLanguage };
}
