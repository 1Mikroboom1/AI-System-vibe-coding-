# RAG Desktop

RAG Desktop — это React + TypeScript + Express приложение для чата с моделями, управления настройками и RAG-режима. Оно работает как веб-приложение и как Electron desktop app.

Этот README — единый источник правды по запуску, настройке провайдеров, OmniRoute и локальным endpoint’ам. Остальные markdown-файлы в репозитории считаются справочными или устаревшими.

## Что поддерживается

- Прямое подключение к Anthropic.
- Прямое подключение к OpenAI.
- Прямое подключение к Grok.
- Прямое подключение к Qwen.
- Прямое подключение к DeepSeek.
- OmniRoute как локальный OpenAI-compatible gateway.
- Local Model через OpenAI-compatible local endpoint.
- В UI провайдеры отображаются как Claude для Anthropic и ChatGPT для OpenAI.
- Выбор модели через Settings и сохранённые model presets.

## Требования

- Node.js 18+
- npm 9+
- Для Electron на Windows: любая поддерживаемая Windows-система, на которой запускается Electron

## Быстрый старт

```bash
npm install
npm run dev
```

После запуска:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

Для desktop-режима:

```bash
npm install
npm run desktop:dev
```

Для production build:

```bash
npm run build
```

## Подключение провайдеров

### Anthropic

- Provider: Anthropic
- UI label: Claude
- API Key: официальный ключ Anthropic
- Base URL не нужен

### OpenAI

- Provider: OpenAI
- UI label: ChatGPT
- API Key: официальный ключ OpenAI
- Base URL не нужен

### Grok

- Provider: Grok
- Base URL: https://api.x.ai/v1
- API Key: ключ xAI

### Qwen

- Provider: Qwen
- Base URL: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
- API Key: ключ Alibaba Cloud / DashScope

### DeepSeek

- Provider: DeepSeek
- Base URL: https://api.deepseek.com/v1
- API Key: ключ DeepSeek

### OmniRoute

- Provider: OmniRoute
- Base URL: http://localhost:20128/v1
- API Key: ключ, выданный OmniRoute dashboard

### Local Model

- Provider: Local Model
- Base URL: OpenAI-compatible локальный endpoint
- Пример: http://localhost:11434/v1
- API Key обычно не нужен

## Что нужно для ошибки `missing upstream credentials`

Если OmniRoute отвечает `missing upstream credentials`, это значит:

1. OmniRoute запущен и принимает запрос.
2. Но внутри OmniRoute не подключен upstream-провайдер.
3. Нужно открыть dashboard OmniRoute и добавить реальный upstream provider: OpenAI, Anthropic или другой поддерживаемый источник.

Важно: это относится только к OmniRoute-режиму. Для прямого подключения к OpenAI или Anthropic OmniRoute не нужен.

## Настройка в приложении

1. Откройте Settings.
2. Выберите провайдера.
3. Введите API Key, если он нужен выбранному провайдеру.
4. Для OmniRoute, Grok, Qwen, DeepSeek или Local Model укажите Base URL.
5. Нажмите Test Connection.
6. Если тест успешен, нажмите Save API Settings.
7. Перейдите в Chat и отправьте сообщение.

## Поведение backend

Backend маршрутизирует запросы так:

- Anthropic -> прямой вызов Anthropic API.
- OpenAI -> прямой вызов OpenAI API.
- Grok -> OpenAI-compatible вызов к xAI.
- Qwen -> OpenAI-compatible вызов к DashScope compatible mode.
- DeepSeek -> OpenAI-compatible вызов к DeepSeek.
- OmniRoute -> OpenAI-compatible вызов через локальный OmniRoute gateway.
- Local Model -> OpenAI-compatible вызов на локальный endpoint.

## Полезные переменные окружения

```bash
PORT=5001
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
OPENAI_MODEL=gpt-4o-mini
OMNIROUTE_BASE_URL=http://localhost:20128/v1
LOCAL_MODEL_BASE_URL=http://localhost:11434/v1
```

## npm scripts

| Команда | Описание |
|---------|---------|
| `npm run dev` | Frontend + backend для веб-версии |
| `npm run client` | Только Vite frontend |
| `npm run server` | Только backend |
| `npm run build` | Production build |
| `npm run start` | Запуск production server |
| `npm run desktop:dev` | Desktop dev mode |
| `npm run desktop:start` | Desktop production run |
| `npm run desktop:build` | Сборка Windows installer |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type check |

## Архитектура

```text
src/
+-- components/   UI и страницы
+-- hooks/        React hooks
+-- lib/          Общие утилиты и provider adapters
+-- server/       Express backend
+-- App.tsx       Корневой компонент
+-- main.tsx      Frontend entry point
L-- index.css     Global styles
```

## Безопасность и корректное использование ИИ

- Не закладывайте в продукт обход лимитов, MITM или проксирование чужих подписок как обязательный сценарий.
- Используйте только те API-ключи и подписки, на которые у вас есть право.
- Для локальных endpoint’ов убедитесь, что они реально OpenAI-compatible и доступны только там, где это нужно.
- OmniRoute удобен как локальный маршрутизатор, но его upstream providers должны быть настроены легитимно.

## Troubleshooting

- `Cannot connect to ...` -> проверьте, что сервис запущен и Base URL корректен.
- `Authentication failed` -> проверьте API Key.
- `Endpoint not found` -> проверьте, что URL заканчивается корректным API route, обычно `/v1`.
- `missing upstream credentials` -> настройте upstream providers в OmniRoute dashboard или переключитесь на прямой провайдер.

## Технический стек

- Frontend: React 18 + TypeScript + Vite
- Desktop: Electron
- Backend: Express 5 + Node.js + TypeScript
- UI: Tailwind CSS + Radix UI

## Примечание

Если вам больше не нужен OmniRoute, просто выберите Anthropic или OpenAI в Settings и работайте напрямую без gateway.