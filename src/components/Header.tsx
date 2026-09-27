import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useLanguage } from "../hooks/useLanguage";
import { languages, type Language, t } from "../lib/i18n";

type Page = "chat" | "document-ocr" | "rag-management" | "settings";

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const { theme, setTheme, themePresets, activeThemeId, setActiveThemeId, upsertThemePreset, deleteThemePreset } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showThemeCreator, setShowThemeCreator] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemePrimary, setNewThemePrimary] = useState("#2563eb");
  const [newThemeSecondary, setNewThemeSecondary] = useState("#38bdf8");

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleCreateTheme = () => {
    if (!newThemeName.trim()) return;
    const saved = upsertThemePreset({
      id: editingThemeId ?? undefined,
      name: newThemeName,
      primary: newThemePrimary,
      secondary: newThemeSecondary
    });
    setActiveThemeId(saved.id);
    setShowThemeCreator(false);
    setEditingThemeId(null);
    setNewThemeName("");
    setNewThemePrimary("#2563eb");
    setNewThemeSecondary("#38bdf8");
    setShowThemePicker(false);
  };

  const openThemeCreator = (preset?: { id: string; name: string; primary: string; secondary: string }) => {
    if (preset) {
      setEditingThemeId(preset.id);
      setNewThemeName(preset.name);
      setNewThemePrimary(preset.primary);
      setNewThemeSecondary(preset.secondary);
    } else {
      setEditingThemeId(null);
      setNewThemeName("");
      setNewThemePrimary("#2563eb");
      setNewThemeSecondary("#38bdf8");
    }
    setShowThemeCreator(true);
  };

  const closeThemeCreator = () => {
    setShowThemeCreator(false);
    setEditingThemeId(null);
    setNewThemeName("");
    setNewThemePrimary("#2563eb");
    setNewThemeSecondary("#38bdf8");
  };

  const languageOptions = Object.keys(languages) as Language[];

  return (
    <header className="sticky top-0 z-50 text-white shadow-lg app-accent-gradient">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold">Super Chat</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowThemePicker(true)}
              className="p-2 hover:bg-white/20 rounded-lg transition"
              title={t("header.themeColors", language)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 10v-8h8v8h-8z" />
              </svg>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-white/20 rounded-lg transition"
              title={t("header.theme", language)}
            >
              {theme === "dark" ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 8h2v-3h-2v3zm7.03-2.03l1.79 1.79 1.79-1.79-1.79-1.79-1.79 1.79zM17 13h3v-2h-3v2zM12 6a6 6 0 100 12 6 6 0 000-12z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M21.64 13a9 9 0 11-9.64-9.64c.12 0 .24.01.36.02A7 7 0 1021.62 12.64c.01.12.02.24.02.36z" />
                </svg>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="p-2 hover:bg-white/20 rounded-lg transition flex items-center gap-1"
                title={t("header.language", language)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M12.87 15.07L10.33 12.56 10.36 12.53c1.04-1.06 1.69-2.5 1.69-4.07 0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6c1.57 0 3.01-.65 4.07-1.69l.29.29v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L12.87 15.07zM6 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                </svg>
                <span className="text-xs font-medium">{language.toUpperCase()}</span>
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-50">
                  {languageOptions.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition ${
                        language === lang
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {languages[lang]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex gap-2 flex-wrap">
          {(["chat", "document-ocr", "rag-management", "settings"] as const).map((page) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`px-4 py-2 rounded-lg transition ${
                currentPage === page
                  ? "bg-white text-blue-600 font-semibold"
                  : "hover:bg-white/20"
              }`}
            >
              {page === "chat" && t("nav.chat", language)}
              {page === "document-ocr" && t("nav.documentAi", language)}
              {page === "rag-management" && t("nav.rag", language)}
              {page === "settings" && t("nav.settings", language)}
            </button>
          ))}
        </nav>
      </div>

      {showThemePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto mx-auto shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t("header.themePicker", language)}</h3>
              <button onClick={() => setShowThemePicker(false)} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700" title={t("common.close", language)}>{t("common.close", language)}</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {themePresets.map((item) => (
                <div
                  key={item.id}
                  className={`relative rounded-lg p-4 text-left border ${item.id === activeThemeId ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'} bg-white/80 dark:bg-slate-900/30 hover:scale-[1.02] transition-transform duration-200 ease-in-out flex flex-col justify-between cursor-pointer`}
                  onClick={() => {
                    setActiveThemeId(item.id);
                    setShowThemePicker(false);
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3 min-h-[28px]">
                      <div className="font-medium text-sm leading-5 pr-2">{item.name}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.id === activeThemeId && <div className="text-xs text-blue-600">{t("header.active", language)}</div>}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openThemeCreator(item);
                          }}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          title={t("settings.edit", language)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteThemePreset(item.id);
                          }}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                          title={t("settings.delete", language)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                            <path d="M6 7h12v14H6V7zm3-4h6l1 1h4v2H4V4h4l1-1zm1 6h2v8h-2V9zm4 0h2v8h-2V9z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex overflow-hidden rounded-lg h-8">
                      <div className="flex-1" style={{ background: item.primary }} />
                      <div className="flex-1" style={{ background: item.secondary }} />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => openThemeCreator()}
                className="rounded-lg p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[132px] flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                title={t("header.addTheme", language)}
              >
                <span className="text-2xl text-slate-400 dark:text-slate-500">+</span>
              </button>
            </div>

            {showThemeCreator && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto shadow-lg">
                  <h3 className="text-lg font-semibold mb-4">{editingThemeId ? (t("settings.edit", language) || "Edit") : (t("header.createTheme", language) || "Create New Theme")}</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t("header.themeName", language) || "Theme Name"}</label>
                      <input
                        type="text"
                        value={newThemeName}
                        onChange={(e) => setNewThemeName(e.target.value)}
                        placeholder="My Custom Theme"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white"
                        onKeyDown={(e) => e.key === "Enter" && handleCreateTheme()}
                      />
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">{t("header.primaryColor", language) || "Primary Color"}</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={newThemePrimary}
                            onChange={(e) => setNewThemePrimary(e.target.value)}
                            className="w-10 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={newThemePrimary}
                            onChange={(e) => setNewThemePrimary(e.target.value)}
                            placeholder="#2563eb"
                            className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">{t("header.secondaryColor", language) || "Secondary Color"}</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={newThemeSecondary}
                            onChange={(e) => setNewThemeSecondary(e.target.value)}
                            className="w-10 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={newThemeSecondary}
                            onChange={(e) => setNewThemeSecondary(e.target.value)}
                            placeholder="#38bdf8"
                            className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2 pb-2">
                      <div className="flex-1 rounded h-12" style={{ background: newThemePrimary }} />
                      <div className="flex-1 rounded h-12" style={{ background: newThemeSecondary }} />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateTheme}
                      disabled={!newThemeName.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {editingThemeId ? (t("settings.save", language) || "Save") : (t("header.create", language) || "Create")}
                    </button>
                    <button
                      onClick={closeThemeCreator}
                      className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      {t("common.close", language)}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
