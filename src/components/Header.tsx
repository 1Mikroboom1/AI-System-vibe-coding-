import { useTheme } from "../hooks/useTheme";

type Page = "chat" | "rag-management" | "settings";

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 text-white shadow-lg app-accent-gradient">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold">Super Chat</div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-white/20 rounded-lg transition"
            title="Toggle theme"
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
        </div>

        <nav className="flex gap-2 flex-wrap">
          {(["chat", "rag-management", "settings"] as const).map((page) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`px-4 py-2 rounded-lg transition ${
                currentPage === page
                  ? "bg-white text-blue-600 font-semibold"
                  : "hover:bg-white/20"
              }`}
            >
              {page === "chat" && "💬 Chat"}
              {page === "rag-management" && "📚 RAG"}
              {page === "settings" && "⚙️ Settings"}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
