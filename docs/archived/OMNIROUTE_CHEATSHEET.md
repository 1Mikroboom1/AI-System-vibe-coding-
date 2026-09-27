# 💡 OmniRoute - Шпаргалка разработчика

## Быстрые примеры кода

### 1. Отправить сообщение к OmniRoute

```typescript
import { sendMessage } from "@/lib/providers";

const response = await sendMessage(
  "http://localhost:20128/v1",
  "<OMNIROUTE_API_KEY>",
  {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "user", content: "Привет, как дела?" }
    ]
  }
);

console.log(response);
// Output: "Привет! Я в порядке, спасибо за вопрос!"
```

### 2. Тестировать подключение

```typescript
import { testOmniRouteConnection } from "@/lib/providers";

const result = await testOmniRouteConnection(
  "http://localhost:20128/v1",
  "<OMNIROUTE_API_KEY>"
);

if (result.status === "connected") {
  console.log("✅", result.message);
} else {
  console.error("❌", result.message);
  console.error("Details:", result.details);
}
```

### 3. Использовать React хук

```typescript
import { useOmniRouteTest } from "@/hooks/useOmniRouteTest";

function TestButton() {
  const { result, isLoading, testConnection } = useOmniRouteTest();

  return (
    <>
      <button 
        onClick={() => testConnection(baseUrl, apiKey)}
        disabled={isLoading}
      >
        {isLoading ? "Testing..." : "Test"}
      </button>

      {result.status === "connected" && (
        <p style={{ color: "green" }}>✅ {result.message}</p>
      )}

      {result.status === "error" && (
        <p style={{ color: "red" }}>❌ {result.message}</p>
      )}
    </>
  );
}
```

### 4. Использовать в backend

```typescript
import { sendMessage } from "../lib/providers";

// В express route
app.post("/api/chat", async (req, res) => {
  try {
    const { message, baseUrl, apiKey } = req.body;

    const response = await sendMessage(baseUrl, apiKey, {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }]
    });

    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
```

## Типы данных

### Provider

```typescript
interface Provider {
  id: string;           // Уникальный идентификатор
  name: string;         // Название провайдера
  baseUrl: string;      // http://localhost:20128/v1
  apiKey: string;       // sk-xxxxx...
  isLocal: boolean;     // true для локальных инстансов
}
```

### OpenAIChatRequest

```typescript
interface OpenAIChatRequest {
  model: string;        // "gpt-3.5-turbo"
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  max_tokens?: number;  // По умолчанию 512
  temperature?: number; // 0.0-1.0, по умолчанию 0.7
  top_p?: number;
  stream?: boolean;
}
```

### ConnectionTestResult

```typescript
interface ConnectionTestResult {
  status: "idle" | "testing" | "connected" | "error" | "unreachable";
  message: string;
  details?: string;
}
```

## API Endpoints

### POST /api/rag/chat
Отправить сообщение и получить ответ

**Request:**
```json
{
  "question": "Привет",
  "provider": "OmniRoute",
  "model": "gpt-3.5-turbo"
}
```

**Response (success):**
```json
{
  "success": true,
  "answer": "Привет! Как дела?",
  "provider": "OmniRoute",
  "model": "gpt-3.5-turbo"
}
```

### POST /api/omniroute/test
Тестировать подключение к OmniRoute

**Request:**
```json
{
  "baseUrl": "http://localhost:20128/v1",
  "apiKey": "sk-xxxxx"
}
```

**Response (success):**
```json
{
  "success": true,
  "status": "connected",
  "message": "Successfully connected to OmniRoute"
}
```

**Response (error):**
```json
{
  "success": false,
  "status": "error",
  "message": "Connection failed",
  "details": "Cannot resolve hostname: localhost"
}
```

## Обработка ошибок

### sendMessage() - возможные исключения

```typescript
try {
  await sendMessage(baseUrl, apiKey, request);
} catch (error) {
  if (error instanceof Error) {
    // "OmniRoute error 401: Invalid API key"
    // "OmniRoute error 404: Not found"
    // "OmniRoute returned non-JSON response"
    // "OmniRoute host cannot be resolved"
    // etc.
    console.error(error.message);
  }
}
```

### testOmniRouteConnection() - статусы

```typescript
const result = await testOmniRouteConnection(baseUrl, apiKey);

switch (result.status) {
  case "connected":
    console.log("✅", result.message);
    break;
  case "error":
    console.error("❌", result.message);
    if (result.details) console.error(result.details);
    break;
  case "unreachable":
    console.error("🔴", result.message);
    if (result.details) console.error(result.details);
    break;
}
```

## Утилиты

### normalizeBaseUrl(value)

```typescript
import { normalizeBaseUrl } from "@/lib/providers";

normalizeBaseUrl("http://localhost:20128/v1/")  // → "http://localhost:20128/v1"
normalizeBaseUrl("  https://api.example.com  ") // → "https://api.example.com"
normalizeBaseUrl(null)                          // → undefined
normalizeBaseUrl("")                            // → undefined
```

### normalizeApiKey(value)

```typescript
import { normalizeApiKey } from "@/lib/providers";

normalizeApiKey("  sk-xxxxx  ")    // → "sk-xxxxx"
normalizeApiKey("'sk-xxxxx'")      // → "sk-xxxxx"
normalizeApiKey(123)               // → undefined
normalizeApiKey(null)              // → undefined
```

### getPortFromUrl(url)

```typescript
import { getPortFromUrl } from "@/lib/providers";

getPortFromUrl("http://localhost:20128/v1")    // → 20128
getPortFromUrl("http://localhost/v1")           // → 80
getPortFromUrl("https://api.example.com/v1")   // → 443
```

## Архитектура файлов

```
src/
├── lib/
│   └── providers.ts              # Основная логика интеграции
│       ├── sendMessage()         # Отправка сообщений
│       ├── testOmniRouteConnection()
│       ├── normalizeBaseUrl()
│       ├── normalizeApiKey()
│       └── ...utilities
│
├── hooks/
│   └── useOmniRouteTest.ts       # React хук для UI
│       └── useOmniRouteTest()
│
├── server/
│   └── server.ts                 # Backend интеграция
│       ├── callOmniRoute()       # Использует sendMessage()
│       └── POST /api/omniroute/test
│
└── components/pages/
    └── SettingsPage.tsx          # UI с кнопкой тестирования
```

## Workflow - От A до Z

### 1. Пользователь вводит параметры в Settings

```typescript
// SettingsPage.tsx
<input value={omniRouteBaseUrl} />  // http://localhost:20128/v1
<input value={apiKey} />             // <OMNIROUTE_API_KEY>
<button onClick={handleTestOmniRoute}>Test Connection</button>
```

### 2. Нажимает "Test Connection"

```typescript
// SettingsPage.tsx
async function handleTestOmniRoute() {
  await testConnection(omniRouteBaseUrl, apiKey);
}
```

### 3. Хук вызывает API endpoint

```typescript
// useOmniRouteTest.ts
const response = await fetch("/api/omniroute/test", {
  method: "POST",
  body: JSON.stringify({ baseUrl, apiKey })
});
```

### 4. Backend обрабатывает запрос

```typescript
// server.ts
app.post('/api/omniroute/test', async (req, res) => {
  const { baseUrl, apiKey } = req.body;
  const result = await testOmniRouteConnection(baseUrl, apiKey);
  res.json({ success: result.status === 'connected', ...result });
});
```

### 5. testOmniRouteConnection() проверяет подключение

```typescript
// providers.ts
export async function testOmniRouteConnection(baseUrl, apiKey) {
  // 1. Нормализация URL
  // 2. Валидация ключа
  // 3. Парсинг URL
  // 4. DNS lookup
  // 5. Отправка тестового запроса
  // 6. Проверка ответа
  // 7. Возврат результата
}
```

### 6. Фронтенд получает результат и отображает

```typescript
// SettingsPage.tsx
{result.status === 'connected' && (
  <div style={{ color: 'green' }}>✅ {result.message}</div>
)}
```

### 7. Пользователь сохраняет настройки

```typescript
// SettingsPage.tsx
await persistSettings(...);
// Base URL и API Key сохранены в backend settingsStore
```

### 8. При отправке сообщения используется сохраненная конфигурация

```typescript
// server.ts - /api/rag/chat
const answer = await callOmniRoute(question, model);
// Использует settingsStore.omniRouteBaseUrl и settingsStore.apiKey
```

## Константы

```typescript
// server.ts
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const DEFAULT_OMNIROUTE_BASE_URL = "http://localhost:20128/v1";

// Используются как fallback если нет сохраненной конфигурации
```

## Environment Variables

```bash
# .env (опционально)
OMNIROUTE_BASE_URL=http://localhost:20128/v1
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
PORT=5001
```

## Отладка

### Логирование в backend

```typescript
// server.ts уже содержит логирование
console.log('[CHAT] Provider call initiated:', activeProvider);
console.log('[OMNIROUTE_TEST]', message);
```

### Проверка запроса в DevTools

1. Открыть DevTools (F12)
2. Network tab
3. Найти POST запрос к `/api/omniroute/test` или `/api/rag/chat`
4. Посмотреть Headers, Request Body, Response

### Тестирование с curl

```bash
# Тестирование подключения
curl -X POST http://localhost:5001/api/omniroute/test \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"http://localhost:20128/v1","apiKey":"sk-xxxxx"}'

# Отправка сообщения
curl -X POST http://localhost:5001/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Hello","provider":"OmniRoute","model":"gpt-3.5-turbo"}'
```

## Памятка по правильному использованию

✅ **Правильно:**
```typescript
baseUrl: "http://localhost:20128/v1"
apiKey: "<OMNIROUTE_API_KEY>"
```

❌ **Неправильно:**
```typescript
baseUrl: "http://localhost:20128"           // Забыли /v1
baseUrl: "https://api.omniroute.io/v1"      // Неверный хост
apiKey: "<OMNIROUTE_API_KEY> " // Trailing space example
```

---

**Вопросы?** Смотрите полную документацию в `OMNIROUTE_INTEGRATION.md`
