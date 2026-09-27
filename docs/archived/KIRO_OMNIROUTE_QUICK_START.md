# Quick Start - OmniRoute Integration

## Правильные параметры подключения к Kiro AI через OmniRoute

**Base URL:** `http://localhost:20128/v1`
**API Key:** `<OMNIROUTE_API_KEY>`
**API Type:** `OpenAI Compatible`

## Шаги подключения

### Важно про безопасность и границы использования

- В этом проекте OmniRoute используется как **локальный OpenAI-compatible gateway**.
- Для работы нужен **реальный upstream provider** в OmniRoute dashboard.
- Схемы с проксированием чужих подписок, MITM или обходом лимитов не являются частью этого проекта и должны использоваться только если это разрешено правилами сервиса и вашей организацией.

### 1. Запустить OmniRoute
```bash
omniroute
```
Сервер должен запуститься на `http://localhost:20128`

### 2. Открыть приложение
Приложение запускается на `http://localhost:3000` (dev) или в Electron окне.

### 3. Перейти в Settings
- Нажать на вкладку "Settings"
- Выбрать провайдер "OmniRoute" из dropdown

### 4. Ввести параметры подключения

**Поле "OmniRoute Base URL":**
```
http://localhost:20128/v1
```

**Поле "API Key":**
```
<OMNIROUTE_API_KEY>
```

### 5. Тестировать подключение
- Нажать кнопку **"Test Connection"** (появляется только для OmniRoute)
- Ждать результата:
  - 🟢 **"Successfully connected to OmniRoute"** - ✅ готово
  - 🔴 Ошибка - проверить параметры и OmniRoute запущен

### 6. Сохранить настройки
- Нажать кнопку **"Save API Settings"**

### 7. Начать общение
- Перейти на страницу "Chat"
- Написать вопрос
- Отправить

## Возможные ошибки и решения

| Ошибка | Решение |
|--------|---------|
| "Cannot resolve hostname: localhost" | OmniRoute не запущен. Выполнить `omniroute` |
| "Cannot connect to OmniRoute server" | Проверить что Base URL правильный: `http://localhost:20128/v1` |
| "API Key is invalid" | Проверить что API Key скопирован правильно |
| "OmniRoute missing upstream credentials" | В OmniRoute dashboard нужно добавить провайдеров (OpenAI и т.д.) |
| "Non-JSON response" | Проверить что Base URL заканчивается на `/v1` |

## Архитектура

```
┌─────────────────┐
│  Chat Interface │
│  (React/Electron)
└────────┬────────┘
         │
    POST /api/rag/chat
         │
┌────────▼──────────────┐
│  Express Backend      │
│  (Node.js)            │
│  - Server: 5001 (dev) │
│  - CallOmniRoute()    │
└────────┬──────────────┘
         │
    POST http://localhost:20128/v1/chat/completions
         │
┌────────▼──────────────┐
│  OmniRoute Gateway    │
│  - localhost:20128    │
│  - Routes to upstream │
└────────┬──────────────┘
         │
    POST https://api.openai.com/v1/...
         │
┌────────▼──────────────┐
│  Upstream Provider    │
│  (OpenAI, Anthropic)  │
└──────────────────────┘
```

## Запрос к OmniRoute

**Метод:** POST  
**URL:** `http://localhost:20128/v1/chat/completions`  
**Заголовки:**
```
Content-Type: application/json
Authorization: Bearer <OMNIROUTE_API_KEY>
```

**Тело (JSON):**
```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "max_tokens": 512,
  "temperature": 0.7
}
```

**Ответ (успех):**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking!"
      }
    }
  ]
}
```

## Коды файлов

**Основной интеграционный код:**
- `src/lib/providers.ts` - Функции отправки и тестирования
- `src/hooks/useOmniRouteTest.ts` - React hook для UI тестирования
- `src/server/server.ts` - Backend интеграция и API endpoints
- `src/components/pages/SettingsPage.tsx` - UI Settings с тестированием

**Типизация:**
- `Provider` - Интерфейс провайдера
- `OpenAIChatRequest` - Формат запроса
- `OpenAIChatResponse` - Формат ответа

## Полезные команды

```bash
# Проверить типы TypeScript
npm run type-check

# Собрать проект
npm run build

# Запустить dev сервер
npm run dev

# Запустить OmniRoute (если установлен)
omniroute
```

## Документация

- `OMNIROUTE_INTEGRATION.md` - Полное руководство интеграции
- `OMNIROUTE_CHANGES.md` - Описание сделанных изменений
- Этот файл - Быстрый старт
