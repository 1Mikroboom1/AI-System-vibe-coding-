import { useLanguage } from "../hooks/useLanguage";
import { t } from "../lib/i18n";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { language } = useLanguage();

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 app-panel">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-semibold mb-2">Super Chat</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("footer.description", language)}
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t("footer.features", language)}</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>{t("footer.featureDocuments", language)}</li>
              <li>{t("footer.featureSemanticSearch", language)}</li>
              <li>{t("footer.featureAiChatContext", language)}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t("footer.techStack", language)}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              React · Express · PostgreSQL
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>{t("footer.rightsReserved", language).replace("{year}", String(currentYear))}</p>
        </div>
      </div>
    </footer>
  );
}
