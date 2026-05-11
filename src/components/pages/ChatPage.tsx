import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createCustomId, getProviderDisplayName, type ModelPreset } from "../../lib/customization";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  from: ChatRole;
  text: string;
  createdAt: string;
  attachments?: MessageAttachment[];
};

type MessageAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type PendingAttachment = {
  id: string;
  file: File;
};

type ChatThread = {
  id: string;
  title: string;
  provider: ModelPreset["provider"];
  model: string;
  modelId: string;
  messages: ChatMessage[];
  updatedAt: string;
};

const CHAT_THREADS_KEY = "rag-chat-threads:v2";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function getChatTitleFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "New Chat";
  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}...` : trimmed;
}

export function ChatPage() {
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<ModelPreset["provider"] | "">("");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string>("");
  const [renameDraft, setRenameDraft] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeChat = useMemo(() => chats.find((item) => item.id === activeChatId) ?? null, [chats, activeChatId]);
  const messages = activeChat?.messages ?? [];

  useEffect(() => {
    fetch('http://localhost:5000/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.settings) {
          if (Array.isArray(data.settings.models)) {
            setModels(data.settings.models);
          }
          if (data.settings.activeModelId) {
            setSelectedModelId(data.settings.activeModelId);
          }
        }
      })
      .catch(() => {});

    const saved = window.localStorage.getItem(CHAT_THREADS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatThread[];
        if (Array.isArray(parsed)) {
          const normalized = parsed.filter((item) => item && item.id && item.modelId && Array.isArray(item.messages));
          setChats(normalized);
          if (normalized[0]?.id) {
            setActiveChatId(normalized[0].id);
          }
        }
      } catch {
        setChats([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!models.length || !chats.length) {
      return;
    }

    const resolvedActive = chats.find((item) => item.id === activeChatId) ?? chats[0];
    if (!resolvedActive) return;

    const selected = models.find((item) => item.id === resolvedActive.modelId);
    if (selected) {
      setSelectedModelId(selected.id);
      setProvider(selected.provider);
      setModel(selected.model);
    } else {
      setProvider(resolvedActive.provider);
      setModel(resolvedActive.model);
    }
  }, [models, chats, activeChatId]);

  useEffect(() => {
    if (!chats.length) return;
    window.localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (!models.length) return;
    if (chats.length) return;

    const fallbackModel = models.find((item) => item.id === selectedModelId) ?? models[0];
    if (!fallbackModel) return;

    const createdAt = new Date().toISOString();
    const initialChat: ChatThread = {
      id: createCustomId("chat"),
      title: "New Chat",
      provider: fallbackModel.provider,
      model: fallbackModel.model,
      modelId: fallbackModel.id,
      messages: [],
      updatedAt: createdAt
    };

    setChats([initialChat]);
    setActiveChatId(initialChat.id);
    setProvider(fallbackModel.provider);
    setModel(fallbackModel.model);
  }, [models, chats.length, selectedModelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeChatId]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const onPaste = (ev: ClipboardEvent) => {
      try {
        const clipboard = ev.clipboardData ?? (window as any).clipboardData;
        if (!clipboard || !clipboard.items) return;

        const incoming: File[] = [];
        for (let i = 0; i < clipboard.items.length; i++) {
          const item = clipboard.items[i];
          if (item && item.kind === 'file') {
            const f = item.getAsFile();
            if (f) incoming.push(f);
          }
        }

        if (incoming.length) {
          ev.preventDefault();
          addIncomingFiles(incoming);
        }
      } catch {
        // ignore paste parsing errors
      }
    };

    el.addEventListener('paste', onPaste as EventListener);
    return () => el.removeEventListener('paste', onPaste as EventListener);
  }, [inputRef, addIncomingFiles]);

  function createChat(modelId: string) {
    const selected = models.find((item) => item.id === modelId) ?? models[0];
    if (!selected) return;

    const now = new Date().toISOString();
    const nextChat: ChatThread = {
      id: createCustomId("chat"),
      title: "New Chat",
      provider: selected.provider,
      model: selected.model,
      modelId: selected.id,
      messages: [],
      updatedAt: now
    };

    setChats((prev) => [nextChat, ...prev]);
    setActiveChatId(nextChat.id);
    setSelectedModelId(selected.id);
    setProvider(selected.provider);
    setModel(selected.model);
    setPendingAttachments([]);
    setAttachmentError("");
  }

  function deleteChat(chatId: string) {
    setChats((prev) => {
      const next = prev.filter((item) => item.id !== chatId);
      if (!next.length) {
        setActiveChatId("");
        return [];
      }

      if (chatId === activeChatId) {
        setActiveChatId(next[0].id);
      }

      return next;
    });
  }

  function selectChat(chatId: string) {
    const next = chats.find((item) => item.id === chatId);
    if (!next) return;
    setActiveChatId(chatId);
    setSelectedModelId(next.modelId);
    setProvider(next.provider);
    setModel(next.model);
    setPendingAttachments([]);
    setAttachmentError("");
    setRenamingChatId("");
    setRenameDraft("");
  }

  function beginRenameChat(chatId: string) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;
    setRenamingChatId(chatId);
    setRenameDraft(chat.title);
  }

  function saveRenameChat(chatId: string) {
    const nextTitle = renameDraft.trim();
    if (!nextTitle) return;
    setChats((prev) => prev.map((item) => (
      item.id === chatId
        ? { ...item, title: nextTitle, updatedAt: new Date().toISOString() }
        : item
    )));
    setRenamingChatId("");
    setRenameDraft("");
  }

  function cancelRenameChat() {
    setRenamingChatId("");
    setRenameDraft("");
  }

  function updateActiveChatModel(modelId: string) {
    const selected = models.find((item) => item.id === modelId);
    if (!selected || !activeChatId) return;

    setSelectedModelId(modelId);
    setProvider(selected.provider);
    setModel(selected.model);

    setChats((prev) => prev.map((item) => (
      item.id === activeChatId
        ? {
            ...item,
            provider: selected.provider,
            model: selected.model,
            modelId: selected.id,
            updatedAt: new Date().toISOString()
          }
        : item
    )));
  }

  function appendMessageToActiveChat(message: ChatMessage) {
    if (!activeChatId) return;
    setChats((prev) => prev.map((item) => {
      if (item.id !== activeChatId) return item;

      const nextMessages = [...item.messages, message];
      const shouldRetitle = item.title === "New Chat" && message.from === "user";

      return {
        ...item,
        title: shouldRetitle ? getChatTitleFromText(message.text) : item.title,
        messages: nextMessages,
        updatedAt: new Date().toISOString()
      };
    }));
  }

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (!incomingFiles.length) return;

    addIncomingFiles(incomingFiles);
    event.target.value = "";
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  function addIncomingFiles(incomingFiles: File[]) {
    if (!incomingFiles.length) return;

    const prepared: PendingAttachment[] = [];
    let firstError = "";

    for (const file of incomingFiles) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        firstError = `File ${file.name} is too large. Limit is 10 MB per file.`;
        continue;
      }

      prepared.push({
        id: createCustomId("file"),
        file
      });
    }

    if (prepared.length) {
      setPendingAttachments((prev) => [...prev, ...prepared]);
    }
    setAttachmentError(firstError);
  }

  function uploadWithProgress(formData: FormData): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "http://localhost:5000/api/rag/chat");

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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const incomingFiles = Array.from(event.dataTransfer.files ?? []);
    addIncomingFiles(incomingFiles);
  }

  async function handleSend() {
    if (!activeChatId || !selectedModelId || !provider || !model) {
      appendMessageToActiveChat({ from: "assistant", text: "No saved models are available. Add one in Settings first.", createdAt: new Date().toISOString() });
      return;
    }
    if (!input.trim() && pendingAttachments.length === 0) return;

    const question = input.trim() || "Analyze attached files";
    const userMessage: ChatMessage = {
      from: "user",
      text: question,
      createdAt: new Date().toISOString(),
      attachments: pendingAttachments.map((item) => ({
        id: item.id,
        name: item.file.name,
        size: item.file.size,
        type: item.file.type || "application/octet-stream"
      }))
    };
    appendMessageToActiveChat(userMessage);
    setInput('');
    setPendingAttachments([]);
    setAttachmentError("");
    setUploadProgress(0);
    setLoading(true);

    try {
      let res: Response;
      if (pendingAttachments.length > 0) {
        const formData = new FormData();
        formData.append("question", question);
        formData.append("provider", provider);
        formData.append("model", model);
        for (const item of pendingAttachments) {
          formData.append("files", item.file);
        }

        res = await uploadWithProgress(formData);
      } else {
        setUploadProgress(100);
        res = await fetch('http://localhost:5000/api/rag/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, provider, model })
        });
      }

      const j = await res.json();
      if (j?.success) {
        appendMessageToActiveChat({ from: "assistant", text: j.answer ?? "No answer", createdAt: new Date().toISOString() });
      } else {
        const errorText = res.status === 401
          ? `Authentication failed: invalid ${provider} API key. Please save a valid key in Settings.`
          : (j?.error ?? 'Error from server');
        appendMessageToActiveChat({ from: "assistant", text: errorText, createdAt: new Date().toISOString() });
      }
    } catch {
      appendMessageToActiveChat({ from: "assistant", text: "Network error", createdAt: new Date().toISOString() });
    } finally {
      setUploadProgress(0);
      setLoading(false);
    }
  }

  async function copyMessage(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1500);
    } catch {
      setCopiedMessageId(null);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <div className="app-panel rounded-2xl p-8">
        <h2 className="text-3xl font-bold mb-2 app-accent-text">Super Chat</h2>
        <p className="text-slate-600 dark:text-slate-400">Chat with your documents using advanced retrieval-augmented generation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 app-panel rounded-2xl p-4 h-fit">
          <h3 className="font-semibold mb-4">Recent Chats</h3>

          <label htmlFor="chat-model" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Model in active chat</label>
          <select
            id="chat-model"
            name="chat-model"
            value={selectedModelId}
            disabled={!models.length}
            onChange={(e) => {
              updateActiveChatModel(e.target.value);
            }}
            className="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 dark:text-white disabled:opacity-60"
          >
            <option value="">{models.length ? "Select saved model" : "No saved models"}</option>
            {models.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {getProviderDisplayName(option.provider)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => createChat(selectedModelId)}
            disabled={!models.length}
            className="mb-3 w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            Create Chat
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Active: {provider ? `${getProviderDisplayName(provider)} · ${model}` : "No active chat"}
          </p>
          {!models.length && <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">Create and save models in Settings to enable chat.</p>}
          <div className="space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className={`p-3 rounded-lg transition cursor-pointer ${chat.id === activeChatId ? "bg-blue-50/80 dark:bg-blue-900/30" : "bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {renamingChatId === chat.id ? (
                      <input
                        value={renameDraft}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveRenameChat(chat.id);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRenameChat();
                          }
                        }}
                        className="w-full text-sm font-medium px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">{chat.title}</p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {getProviderDisplayName(chat.provider)} · {chat.model}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {renamingChatId === chat.id ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveRenameChat(chat.id);
                          }}
                          className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                          title="Save"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRenameChat();
                          }}
                          className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900/20"
                          title="Cancel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                            <path d="M18.3 5.71L12 12l6.3 6.29-1.42 1.42L10.59 13.41 4.29 19.71 2.87 18.29 9.17 12 2.87 5.71 4.29 4.29 10.59 10.59 16.88 4.29z"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          beginRenameChat(chat.id);
                        }}
                        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                        title="Rename"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                        <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
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
            className={`app-panel rounded-2xl p-6 h-96 overflow-y-auto overflow-x-hidden border-2 border-dashed app-scrollbar transition ${isDragOver ? "border-blue-500 bg-blue-50/40 dark:bg-blue-900/20" : "border-slate-300 dark:border-slate-600"}`}
          >
            <div className="flex min-h-full flex-col justify-end space-y-3">
              {messages.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400 text-center">Start a conversation by typing a question about your documents below...</p>
              )}
              {isDragOver && (
                <div className="mb-2 text-center text-sm font-medium text-blue-600 dark:text-blue-300">
                  Drop files here to attach
                </div>
              )}
              {messages.map((m, idx) => {
                const messageId = `${m.createdAt}-${idx}`;

                return (
                  <div key={messageId} className={m.from === 'user' ? 'text-right' : 'text-left'}>
                    <div className={m.from === 'user' ? 'inline-block bg-blue-600 text-white px-3 py-2 rounded-lg max-w-full break-words' : 'inline-block bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg max-w-full break-words'}>
                      {m.text}
                    </div>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className={m.from === "user" ? "mt-2 flex justify-end gap-2 flex-wrap" : "mt-2 flex justify-start gap-2 flex-wrap"}>
                        {m.attachments.map((file) => (
                          <span
                            key={`${messageId}-${file.name}`}
                            className="px-2 py-1 rounded-full text-xs border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/60"
                          >
                            {file.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.from === 'assistant' && (
                      <div className="mt-2 flex justify-start">
                        <button
                          type="button"
                          onClick={() => copyMessage(m.text, messageId)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/70 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span>{copiedMessageId === messageId ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-sm"
            >
              Attach
            </button>
            <input
              id="chat-input"
              name="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              type="text"
              placeholder="Ask a question about your documents..."
                className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>

          {(pendingAttachments.length > 0 || attachmentError) && (
            <div className="app-panel rounded-xl p-3">
              {attachmentError && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">{attachmentError}</p>
              )}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => removePendingAttachment(file.id)}
                      className="px-2 py-1 rounded-full text-xs border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/70"
                    >
                      {file.file.name} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="app-panel rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-600 dark:text-slate-300">Uploading attachments</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
