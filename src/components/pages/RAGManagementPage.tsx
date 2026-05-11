export function RAGManagementPage() {
  return (
    <div className="py-8 space-y-6">
      <div className="app-panel rounded-2xl p-8">
        <h2 className="text-3xl font-bold mb-2 app-accent-text">RAG Management</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Manage documents, knowledge bases, and embeddings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">📄 Documents</h3>
          <div className="space-y-3">
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 transition">
              <p className="font-medium text-sm">Sample Document</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">0 chunks · 0 embeddings</p>
            </div>
          </div>
          <button className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            + Import Document
          </button>
        </div>

        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">🗂️ Knowledge Bases</h3>
          <div className="space-y-3">
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <p className="font-medium text-sm">Default KB</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">0 documents</p>
            </div>
          </div>
          <button className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            + Create Knowledge Base
          </button>
        </div>

        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">🔢 Embeddings</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            0 embeddings generated
          </p>
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            Generate Embeddings
          </button>
        </div>

        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">🔍 Semantic Search</h3>
          <input
            type="text"
            placeholder="Search your knowledge base..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 mb-2 dark:text-white"
          />
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
