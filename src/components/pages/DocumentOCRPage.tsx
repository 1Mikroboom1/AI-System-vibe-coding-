import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { createCustomId, getProviderDisplayName, type ModelPreset } from "../../lib/customization";
import { t, type Language } from "../../lib/i18n";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

type OCRResult = {
  text: string;
  createdAt: string;
  modelLabel: string;
};

type LocalFieldType = "string" | "number" | "date" | "email" | "phone" | "amount";

type LocalFieldDefinition = {
  id: string;
  name: string;
  type: LocalFieldType;
  enabled: boolean;
  hint?: string;
};

type LocalFieldExtraction = {
  fieldId: string;
  fieldName: string;
  type: LocalFieldType;
  value: string;
  confidence: number;
};

interface DocumentOCRPageProps {
  language: Language;
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export function DocumentOCRPage({ language }: DocumentOCRPageProps) {
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [localFields, setLocalFields] = useState<LocalFieldDefinition[]>([]);
  const [samplesCount, setSamplesCount] = useState(0);
  const [trainText, setTrainText] = useState("");
  const [trainBusy, setTrainBusy] = useState(false);
  const [trainStatus, setTrainStatus] = useState("");
  const [fieldNameDraft, setFieldNameDraft] = useState("");
  const [fieldHintDraft, setFieldHintDraft] = useState("");
  const [fieldTypeDraft, setFieldTypeDraft] = useState<LocalFieldType>("string");
  const [typizeBusy, setTypizeBusy] = useState(false);
  const [typedFields, setTypedFields] = useState<LocalFieldExtraction[]>([]);
  const [persistBusy, setPersistBusy] = useState(false);
  const [persistStatus, setPersistStatus] = useState("");

  const selectedPreset = useMemo(() => models.find((item) => item.id === selectedModelId) ?? null, [models, selectedModelId]);

  async function refreshLocalModelState() {
    const stateResponse = await fetch("/api/local-doc-model/state");
    const statePayload = await stateResponse.json();
    if (!statePayload?.success || !statePayload?.model) return;

    const incomingFields = Array.isArray(statePayload.model.fields) ? statePayload.model.fields as LocalFieldDefinition[] : [];
    setLocalFields(incomingFields);
    setSamplesCount(Number(statePayload.model.samplesCount || 0));
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.success || !data?.settings) return;

        const allModels: ModelPreset[] = Array.isArray(data.settings.models) ? (data.settings.models as ModelPreset[]) : [];
        const localModels = allModels.filter((item) => item.provider === "Local Model");
        setModels(localModels);

        const activeId = typeof data.settings.activeModelId === "string" ? data.settings.activeModelId : "";
        const initial = localModels.find((item) => item.id === activeId) ?? localModels[0] ?? null;
        if (initial) {
          setSelectedModelId(initial.id);
          setModel(initial.model);
        }
      })
      .catch(() => {});

    void refreshLocalModelState().catch(() => {});
  }, []);

  function addIncomingFiles(incomingFiles: File[]) {
    if (!incomingFiles.length) return;

    const prepared: PendingAttachment[] = [];
    let firstError = "";

    for (const file of incomingFiles) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        firstError = t("chat.fileTooLarge", language).replace("{name}", file.name);
        continue;
      }

      prepared.push({
        id: createCustomId("doc-file"),
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
      });
    }

    if (prepared.length) {
      setPendingAttachments((prev) => [...prev, ...prepared]);
    }

    setAttachmentError(firstError);
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (!incomingFiles.length) return;
    addIncomingFiles(incomingFiles);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const incomingFiles = Array.from(event.dataTransfer.files ?? []);
    addIncomingFiles(incomingFiles);
  }

  function uploadWithProgress(formData: FormData): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/rag/chat");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        resolve(new Response(xhr.responseText || "", { status: xhr.status, statusText: xhr.statusText }));
      };

      xhr.onerror = () => {
        reject(new Error("Upload failed"));
      };

      xhr.send(formData);
    });
  }

  async function handleRecognize() {
    if (!selectedModelId || !model) {
      setAttachmentError("Сохраните хотя бы одну локальную модель в Настройках и выберите её.");
      return;
    }

    if (!pendingAttachments.length) {
      setAttachmentError(t("chat.documentAttachHint", language));
      return;
    }

    setAttachmentError("");
    setUploadProgress(0);
    setLoading(true);

    const basePrompt = prompt.trim() || t("chat.documentDefaultPrompt", language);
    const question = `${t("chat.documentSystemPrompt", language)}\n\n${basePrompt}`;

    try {
      const formData = new FormData();
      formData.append("question", question);
      formData.append("provider", "Local Model");
      formData.append("model", model);
      for (const item of pendingAttachments) {
        formData.append("files", item.file);
      }

      const res = await uploadWithProgress(formData);
      const payload = await res.json();
      if (!payload?.success) {
        setAttachmentError(payload?.error ?? t("chat.serverError", language));
        return;
      }

      const modelLabel = `${getProviderDisplayName("Local Model")} · ${model}`;
      const text = payload.answer ?? "";
      setResult({ text, createdAt: new Date().toISOString(), modelLabel });
      setTrainText(text);
      setPrompt("");
      setPendingAttachments([]);
      setTypedFields([]);
      setCopied(false);
    } catch {
      setAttachmentError(t("chat.networkError", language));
    } finally {
      setUploadProgress(0);
      setLoading(false);
    }
  }

  async function copyResultText() {
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function saveFieldSchema(nextFields: LocalFieldDefinition[]) {
    const res = await fetch("/api/local-doc-model/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: nextFields })
    });
    const payload = await res.json();
    if (!payload?.success) {
      throw new Error(payload?.error || "Field schema save failed");
    }
    setLocalFields(Array.isArray(payload.fields) ? payload.fields as LocalFieldDefinition[] : nextFields);
  }

  async function handleAddField() {
    const fieldName = fieldNameDraft.trim();
    if (!fieldName) return;
    const next = [
      ...localFields,
      {
        id: createCustomId("field"),
        name: fieldName,
        type: fieldTypeDraft,
        enabled: true,
        hint: fieldHintDraft.trim() || undefined
      }
    ];

    try {
      await saveFieldSchema(next);
      setFieldNameDraft("");
      setFieldHintDraft("");
      setFieldTypeDraft("string");
    } catch {
      setAttachmentError("Не удалось сохранить поле.");
    }
  }

  async function handleToggleField(fieldId: string) {
    const next = localFields.map((field) => (
      field.id === fieldId ? { ...field, enabled: !field.enabled } : field
    ));
    try {
      await saveFieldSchema(next);
    } catch {
      setAttachmentError("Не удалось обновить поле.");
    }
  }

  async function handleTrainLocalModel() {
    if (!trainText.trim() && pendingAttachments.length === 0) {
      setTrainStatus("Добавьте текст или файл для обучения.");
      return;
    }

    setTrainBusy(true);
    setTrainStatus("");

    try {
      const formData = new FormData();
      if (trainText.trim()) {
        formData.append("text", trainText.trim());
      }
      for (const item of pendingAttachments) {
        formData.append("files", item.file);
      }

      const res = await fetch("/api/local-doc-model/train", {
        method: "POST",
        body: formData
      });
      const payload = await res.json();
      if (!payload?.success) {
        setTrainStatus(payload?.error || "Ошибка обучения локальной модели.");
        return;
      }

      setSamplesCount(Number(payload.totalSamples || samplesCount));
      setTrainStatus(`Обучение завершено: +${payload.addedSamples || 0} примеров, всего ${payload.totalSamples || samplesCount}.`);
    } catch {
      setTrainStatus("Ошибка сети при обучении.");
    } finally {
      setTrainBusy(false);
    }
  }

  async function handleTypize() {
    const text = (result?.text || trainText).trim();
    if (!text) {
      setAttachmentError("Добавьте или распознайте текст перед типизацией.");
      return;
    }

    const fieldIds = localFields.filter((field) => field.enabled).map((field) => field.id);
    if (!fieldIds.length) {
      setAttachmentError("Выберите хотя бы одно поле для типизации.");
      return;
    }

    setTypizeBusy(true);
    setAttachmentError("");

    try {
      const res = await fetch("/api/local-doc-model/typize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fieldIds })
      });
      const payload = await res.json();
      if (!payload?.success) {
        setAttachmentError(payload?.error || "Ошибка типизации.");
        return;
      }
      setTypedFields(Array.isArray(payload.extracted) ? payload.extracted as LocalFieldExtraction[] : []);
    } catch {
      setAttachmentError("Ошибка сети при типизации.");
    } finally {
      setTypizeBusy(false);
    }
  }

  async function requestDirectorySelection(): Promise<string | null> {
    if (!window.desktop?.selectDirectory) {
      setPersistStatus("Выбор директории доступен только в desktop-версии приложения.");
      return null;
    }

    try {
      return await window.desktop.selectDirectory();
    } catch {
      setPersistStatus("Не удалось открыть диалог выбора директории.");
      return null;
    }
  }

  async function handleExportLocalModel() {
    const directoryPath = await requestDirectorySelection();
    if (!directoryPath) return;

    setPersistBusy(true);
    setPersistStatus("");
    try {
      const response = await fetch("/api/local-doc-model/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath })
      });
      const payload = await response.json();
      if (!payload?.success) {
        setPersistStatus(payload?.error || "Ошибка сохранения модели.");
        return;
      }

      setPersistStatus(`Модель сохранена: ${payload.filePath}`);
    } catch {
      setPersistStatus("Ошибка сети при сохранении модели.");
    } finally {
      setPersistBusy(false);
    }
  }

  async function handleImportLocalModel() {
    const directoryPath = await requestDirectorySelection();
    if (!directoryPath) return;

    setPersistBusy(true);
    setPersistStatus("");
    try {
      const response = await fetch("/api/local-doc-model/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath })
      });
      const payload = await response.json();
      if (!payload?.success) {
        setPersistStatus(payload?.error || "Ошибка импорта модели.");
        return;
      }

      await refreshLocalModelState();
      setPersistStatus(`Модель импортирована: ${payload.fields} полей, ${payload.samples} примеров.`);
    } catch {
      setPersistStatus("Ошибка сети при импорте модели.");
    } finally {
      setPersistBusy(false);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <section className="rounded-3xl border border-sky-200/70 dark:border-sky-900/40 bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300 mb-2">{t("doc.badge", language)}</p>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{t("doc.title", language)}</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-3xl">
          {t("doc.description", language)} Локальный контур: распознавание через Local Model, обучение и типизация полей без внешних источников.
        </p>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-4 app-panel rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-semibold">{t("doc.workspace", language)}</h3>

          <div>
            <label htmlFor="doc-model" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t("chat.modelSelect", language)}</label>
            <select
              id="doc-model"
              name="doc-model"
              value={selectedModelId}
              disabled={!models.length || loading}
              onChange={(e) => {
                const next = models.find((item) => item.id === e.target.value);
                setSelectedModelId(e.target.value);
                if (next) {
                  setModel(next.model);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white disabled:opacity-60"
            >
              <option value="">{models.length ? t("chat.selectModel", language) : "Нет локальных моделей"}</option>
              {models.map((option) => (
                <option key={option.id} value={option.id}>{option.name} · {option.model}</option>
              ))}
            </select>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragOver(false);
              }
            }}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-4 transition ${isDragOver ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20" : "border-slate-300 dark:border-slate-600"}`}
          >
            <p className="text-sm font-medium mb-1">{t("doc.attachments", language)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t("chat.documentModeHint", language)}</p>
            <label className="inline-flex cursor-pointer rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">
              {t("chat.attach", language)}
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml"
                className="hidden"
                onChange={handleFilesSelected}
              />
            </label>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("chat.documentInputPlaceholder", language)}
            className="w-full min-h-[90px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 px-3 py-2 text-sm dark:text-white"
          />

          <button
            type="button"
            onClick={handleRecognize}
            disabled={loading || !selectedPreset}
            className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? t("chat.sending", language) : t("doc.sendForRecognition", language)}
          </button>

          {loading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{t("chat.uploadAttachments", language)}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-sky-600" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="space-y-2">
              {pendingAttachments.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5">
                  {item.previewUrl ? <img src={item.previewUrl} alt={item.file.name} className="h-10 w-10 rounded object-cover" /> : <span className="text-xs">{item.file.type || "file"}</span>}
                  <span className="text-xs truncate flex-1">{item.file.name}</span>
                  <button type="button" onClick={() => removePendingAttachment(item.id)} className="text-xs rounded-full border border-slate-300 dark:border-slate-600 px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-4 app-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Локальная модель обучения</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">samples: {samplesCount}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportLocalModel}
              disabled={persistBusy}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              Сохранить в папку
            </button>
            <button
              type="button"
              onClick={handleImportLocalModel}
              disabled={persistBusy}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              Импорт из папки
            </button>
          </div>

          {persistStatus && <p className="text-xs text-slate-600 dark:text-slate-300">{persistStatus}</p>}

          <textarea
            value={trainText}
            onChange={(e) => setTrainText(e.target.value)}
            placeholder="Текст для обучения модели (можно вставить распознанный результат или вручную подготовленный документ)"
            className="w-full min-h-[150px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 px-3 py-2 text-sm dark:text-white"
          />

          <button
            type="button"
            onClick={handleTrainLocalModel}
            disabled={trainBusy}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {trainBusy ? "Обучение..." : "Обучить локальную модель"}
          </button>

          {trainStatus && <p className="text-xs text-slate-600 dark:text-slate-300">{trainStatus}</p>}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold mb-2">Поля для типизации</h4>
            <div className="grid grid-cols-1 gap-2 mb-2">
              {localFields.map((field) => (
                <label key={field.id} className="flex items-center gap-2 text-xs rounded border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                  <input type="checkbox" checked={field.enabled} onChange={() => handleToggleField(field.id)} />
                  <span className="font-medium">{field.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">({field.type})</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input value={fieldNameDraft} onChange={(e) => setFieldNameDraft(e.target.value)} placeholder="Название поля" className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs" />
              <input value={fieldHintDraft} onChange={(e) => setFieldHintDraft(e.target.value)} placeholder="Подсказка (синонимы через запятую)" className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs" />
              <select value={fieldTypeDraft} onChange={(e) => setFieldTypeDraft(e.target.value as LocalFieldType)} className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs">
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="date">date</option>
                <option value="email">email</option>
                <option value="phone">phone</option>
                <option value="amount">amount</option>
              </select>
              <button type="button" onClick={handleAddField} className="rounded bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 px-2 py-1.5 text-xs">Добавить поле</button>
            </div>
          </div>
        </section>

        <section className="xl:col-span-4 app-panel rounded-2xl p-5 space-y-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">{t("doc.result", language)}</h3>
            <button
              type="button"
              onClick={copyResultText}
              disabled={!result?.text}
              className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              {copied ? t("doc.copiedResult", language) : t("doc.copyResult", language)}
            </button>
          </div>

          <div className="min-h-[200px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-4 overflow-y-auto app-scrollbar">
            {!result ? <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? t("doc.processing", language) : t("doc.empty", language)}</p> : (
              <>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{result.modelLabel} · {new Date(result.createdAt).toLocaleString()}</p>
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-100">{result.text || "-"}</div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleTypize}
            disabled={typizeBusy}
            className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {typizeBusy ? "Типизация..." : "Типизировать выбранные поля"}
          </button>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="text-left px-2 py-2">Поле</th>
                  <th className="text-left px-2 py-2">Тип</th>
                  <th className="text-left px-2 py-2">Значение</th>
                  <th className="text-left px-2 py-2">Уверенность</th>
                </tr>
              </thead>
              <tbody>
                {typedFields.length === 0 && (
                  <tr>
                    <td className="px-2 py-2 text-slate-500 dark:text-slate-400" colSpan={4}>Типизация еще не запускалась.</td>
                  </tr>
                )}
                {typedFields.map((item) => (
                  <tr key={item.fieldId} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-2 py-2">{item.fieldName}</td>
                    <td className="px-2 py-2">{item.type}</td>
                    <td className="px-2 py-2 break-all">{item.value || "-"}</td>
                    <td className="px-2 py-2">{Math.round((item.confidence || 0) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {attachmentError && <p className="text-xs text-red-600 dark:text-red-400">{attachmentError}</p>}
    </div>
  );
}
