import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ChatPage } from "./components/pages/ChatPage";
import { RAGManagementPage } from "./components/pages/RAGManagementPage";
import { SettingsPage } from "./components/pages/SettingsPage";
import { useTheme } from "./hooks/useTheme";

type Page = "chat" | "rag-management" | "settings";

export default function App() {
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState<Page>("chat");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const mode = window.localStorage.getItem("rag-desktop-devtools-mode");
    if (mode === "off" || mode === "detach" || mode === "right") {
      void window.desktop?.setDevToolsMode?.(mode);
    }
  }, []);

  const renderContent = () => {
    switch (currentPage) {
      case "rag-management":
        return <RAGManagementPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 container mx-auto px-4 sm:px-6">
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}
