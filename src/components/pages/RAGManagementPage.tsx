import { t, type Language } from "../../lib/i18n";

interface RAGManagementPageProps {
  language: Language;
}

export function RAGManagementPage({ language }: RAGManagementPageProps) {
  return (
    <div className="py-8 space-y-6">
      <div className="app-panel rounded-2xl p-8">
        <h2 className="text-3xl font-bold mb-2 app-accent-text">{t("rag.title", language)}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("rag.description", language)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t("rag.documents", language)}</h3>
          <div className="space-y-3">
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 transition">
              <p className="font-medium text-sm">{t("rag.sampleDocument", language)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("rag.sampleDocStats", language)}</p>
            </div>
          </div>
          <button className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            {t("rag.importDocument", language)}
          </button>
        </div>

        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t("rag.knowledgeBases", language)}</h3>
          <div className="space-y-3">
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <p className="font-medium text-sm">{t("rag.defaultKB", language)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("rag.defaultKbDocs", language)}</p>
            </div>
          </div>
          <button className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            {t("rag.createKB", language)}
          </button>
        </div>

        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t("rag.embeddings", language)}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            0 {t("rag.embeddingsGenerated", language)}
          </p>
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            {t("rag.generateEmbeddings", language)}
          </button>
        </div>

        <div className="app-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t("rag.semanticSearch", language)}</h3>
          <input
            type="text"
            placeholder={t("rag.searchDocuments", language)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 mb-2 dark:text-white"
          />
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            {t("rag.search", language)}
          </button>
        </div>
      </div>
    </div>
  );
}
