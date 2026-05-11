export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 app-panel">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-semibold mb-2">Super Chat</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enterprise document retrieval and AI chat system
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>📄 Document Management</li>
              <li>🔍 Semantic Search</li>
              <li>💬 AI Chat with Context</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Tech Stack</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              React · Express · PostgreSQL
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>&copy; {currentYear} Super Chat. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
