# RAG Desktop

RAG Desktop - локальное desktop-приложение для работы с большими языковыми моделями, документами и задачами распознавания текста. Проект объединяет React-интерфейс, Express backend и Electron-оболочку для Windows.

## Состояние проекта

Реализовано и доступно для использования:

- чат с поддерживаемыми AI-провайдерами;
- отправка текстовых запросов и файловых вложений;
- режим распознавания сканов, фотографий и рукописного текста через локальный OpenAI-compatible endpoint;
- локальная модель документов: поля, обучение на примерах, типизация и импорт/экспорт состояния;
- настройки провайдера, API key, Base URL и пользовательских model presets;
- проверка соединения с провайдером;
- загрузка списка моделей OpenRouter и сохранение избранных моделей;
- светлая и темная темы, пользовательские цветовые схемы и переключение языка;
- запуск в браузере через Vite и запуск как Windows-приложения через Electron.

Частично реализовано или пока является каркасом:

- экран управления RAG содержит демонстрационные элементы интерфейса;
- endpoint импорта документа возвращает заготовочный ответ;
- semantic search пока возвращает пустой список результатов;
- автоматические тесты в `package.json` не настроены.

## Возможности интерфейса

### Chat

Раздел Chat отправляет запросы выбранной модели через backend. Можно выбрать сохраненный preset, написать вопрос, прикрепить до 8 файлов и просмотреть историю диалога для пары provider/model. Максимальный размер одного файла - 10 MB.

Для Anthropic вложения преобразуются в текстовый контекст. Для OpenAI-compatible провайдеров изображения передаются как multimodal content, текстовые файлы добавляются в контекст, а бинарные файлы получают усеченный Base64 preview.

### Document AI / OCR

Раздел Document AI использует сохраненную модель `Local Model`, которая обращается к локальному или другому OpenAI-compatible endpoint. Пользователь прикрепляет изображения или документы, задает инструкцию и получает результат распознавания. Для загрузки отображается прогресс.

### Локальная модель документов

Для документов можно настроить поля следующих типов:

- `string` - строка;
- `number` - число;
- `date` - дата;
- `email` - адрес электронной почты;
- `phone` - телефон;
- `amount` - сумма.

Доступны добавление и изменение схемы полей, обучение на тексте и загруженных файлах, автоматическое извлечение значений, экспорт и импорт состояния модели.

### RAG Management

Раздел RAG Management подготовлен для управления документами, базами знаний, embeddings и семантическим поиском. Текущая версия интерфейса содержит демонстрационные карточки, а полноценное хранилище документов и поисковый индекс еще не подключены.

### Settings

В настройках можно:

- выбрать провайдера;
- ввести API key и Base URL;
- добавить, изменить, удалить и выбрать активный model preset;
- загрузить и обновить список моделей OpenRouter;
- сохранить избранные модели OpenRouter;
- проверить соединение;
- выбрать режим Electron DevTools;
- управлять темой и языком приложения.

## Поддерживаемые провайдеры

| Провайдер | Base URL по умолчанию | API key |
| --- | --- | --- |
| Anthropic | `https://api.anthropic.com/v1` | обязателен |
| OpenAI | `https://api.openai.com/v1` | обязателен |
| Grok / X.AI | `https://api.x.ai/v1` | обязателен |
| Qwen / DashScope | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | обязателен |
| DeepSeek | `https://api.deepseek.com/v1` | обязателен |
| OmniRoute | `http://localhost:20128/v1` | обязателен для настроенного gateway |
| OpenRouter | `https://openrouter.ai/v1` | обязателен |
| Local Model | `http://localhost:11434/v1` | необязателен |

Все OpenAI-compatible провайдеры используют маршрут `/chat/completions`. Для OpenRouter приложение добавляет заголовки `HTTP-Referer` и `X-OpenRouter-Title` и умеет получать список моделей.

OmniRoute должен иметь собственные upstream credentials. API key, введенный в RAG Desktop, авторизует gateway, но не заменяет ключи провайдеров, настроенные внутри OmniRoute.

В интерфейсе Anthropic отображается как `Claude`, а OpenAI - как `ChatGPT`. Для Anthropic и OpenAI Base URL обычно не требуется, для OmniRoute, Grok, Qwen, DeepSeek и Local Model Base URL можно указать в настройках.

## Требования

- Node.js 18 или новее;
- npm 9 или новее;
- Windows требуется для сборки Windows installer;
- для локальной работы провайдера нужен запущенный OmniRoute, Ollama, LM Studio или другой OpenAI-compatible server.

## Установка и запуск

Установить зависимости:

```bash
npm install
```

Запустить frontend и backend в режиме разработки:

```bash
npm run dev
```

Адреса разработки:

- frontend: `http://localhost:3000`;
- backend API: `http://localhost:5000`;
- health-check: `http://localhost:5000/api/health`.

Запустить Electron с Vite и backend:

```bash
npm run desktop:dev
```

В режиме разработки Electron подключается к Vite, поддерживает HMR и открывает DevTools.

## Настройка провайдера в приложении

1. Откройте `Settings`.
2. Выберите провайдера.
3. Введите API key, если он требуется выбранному провайдеру.
4. Укажите Base URL для провайдеров с настраиваемым endpoint-ом.
5. Нажмите `Test Connection`.
6. После успешной проверки нажмите `Save API Settings`.
7. Перейдите в `Chat`, выберите сохраненную модель и отправьте сообщение.

Если OmniRoute отвечает `missing upstream credentials`, gateway доступен, но внутри него не настроены upstream credentials. Откройте dashboard OmniRoute и добавьте разрешенный upstream provider, например OpenAI или Anthropic. Для прямого подключения к OpenAI или Anthropic OmniRoute не нужен.

## Конфигурация и секреты

Файл `api codes.txt` предназначен для локального хранения реальных ключей провайдеров и добавлен в `.gitignore`. Не публикуйте его, не добавляйте в commit и не вставляйте реальные ключи в исходники, README, архивную документацию или логи.

В документации используйте только placeholders:

```text
<ANTHROPIC_API_KEY>
<OPENAI_API_KEY>
<OMNIROUTE_API_KEY>
<DEEPSEEK_API_KEY>
<OPENROUTER_API_KEY>
```

Шаблон `.env.example` содержит безопасные примерные значения. При необходимости создайте локальный `.env` и замените значения на свои:

```dotenv
PORT=5000
NODE_ENV=development
OPENAI_API_KEY=<OPENAI_API_KEY>
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
OPENAI_MODEL=gpt-4o-mini
OMNIROUTE_BASE_URL=http://localhost:20128/v1
LOCAL_MODEL_BASE_URL=http://localhost:11434/v1
```

Поддерживаемые переменные Base URL также включают `XAI_BASE_URL`, `QWEN_BASE_URL`, `DEEPSEEK_BASE_URL` и `OPENROUTER_BASE_URL`. Модель OpenRouter можно переопределить через `OPENROUTER_MODEL`, модель OmniRoute - через `OMNIROUTE_MODEL`.

## Backend API

Backend реализован в `src/server/server.ts` и работает через Express.

| Метод и маршрут | Назначение |
| --- | --- |
| `GET /api/health` | Проверка доступности backend |
| `GET /api/settings` | Получение локальных настроек |
| `POST /api/settings` | Сохранение провайдера, модели и presets |
| `POST /api/rag/chat` | Чат с текстом и multipart file attachments |
| `GET /api/rag/history` | История для выбранных provider/model |
| `POST /api/rag/semantic-search` | Заготовка semantic search, сейчас возвращает пустой результат |
| `POST /api/rag/import-document` | Заготовка импорта документа |
| `POST /api/providers/test` | Универсальная проверка провайдера |
| `POST /api/omniroute/test` | Проверка OmniRoute |
| `GET /api/openrouter/models` | Получение списка моделей OpenRouter |
| `POST /api/openrouter/refresh-models` | Обновление списка моделей OpenRouter |
| `GET /api/openrouter/favorites` | Получение избранных моделей |
| `POST /api/openrouter/favorites` | Сохранение избранных моделей |
| `GET /api/local-doc-model/state` | Состояние локальной модели и поля |
| `POST /api/local-doc-model/fields` | Сохранение схемы полей |
| `POST /api/local-doc-model/train` | Обучение на тексте и файлах |
| `POST /api/local-doc-model/typize` | Извлечение типизированных значений |
| `POST /api/local-doc-model/export` | Экспорт модели в каталог |
| `POST /api/local-doc-model/import` | Импорт модели из каталога |

Запросы к `/api/rag/chat` могут быть JSON или `multipart/form-data`. Backend ограничивает чат восемью файлами и 10 MB на файл, а обучение локальной модели - шестнадцатью файлами.

## Архитектура

```text
React + Vite
	|
	| HTTP / JSON / multipart
	v
Express backend
	|
	+-- provider adapters -> Anthropic, OpenAI, Grok, Qwen, DeepSeek
	|                       OmniRoute, OpenRouter, Local Model
	+-- local document model
	+-- settings and in-memory chat history

Electron main process
	+-- запускает backend в desktop-режиме
	+-- загружает Vite или собранный dist
	+-- управляет окном и DevTools
```

Основные каталоги:

```text
src/App.tsx                         Корневой React-компонент и маршрутизация страниц
src/components/                    Header, Footer и страницы интерфейса
src/hooks/                         React hooks для языка, темы и провайдеров
src/lib/providers.ts                Типы и OpenAI-compatible provider adapters
src/lib/i18n.ts                    Переводы интерфейса
src/lib/customization.ts           Model presets и пользовательские темы
src/server/server.ts               Express backend и API routes
src/local-model/document-model/    Локальная модель документов
src/stores/                        Состояние OpenRouter
electron/main.cjs                  Electron main process
electron/preload.cjs               Безопасный bridge для renderer
scripts/                           Скрипты сборки installer
docs/archived/                     Историческая OmniRoute-документация
```

## NPM-команды

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Frontend и backend в режиме разработки |
| `npm run client` | Только Vite frontend |
| `npm run server` | Только Express backend через ts-node |
| `npm run build` | TypeScript compile и Vite production build |
| `npm run build:server` | Сборка backend через esbuild в `dist/server/server.cjs` |
| `npm run start` | Запуск собранного backend |
| `npm run preview` | Просмотр Vite production build |
| `npm run desktop:dev` | Electron + Vite + backend в development |
| `npm run desktop:start` | Production build и запуск Electron локально |
| `npm run desktop:pack` | Сборка распакованного Electron приложения |
| `npm run desktop:build` | Сборка Windows NSIS installer |
| `npm run type-check` | Проверка TypeScript без генерации файлов |
| `npm run lint` | Запуск ESLint |

## Сборка Windows-приложения

Проверка production-сборки:

```bash
npm run build
npm run build:server
npm run desktop:start
```

Создание installer:

```bash
npm run desktop:build
```

Команды используют две разные конфигурации Electron Builder:

- `npm run desktop:pack` использует конфигурацию `package.json`: `appId` `com.rosatom.ragdesktop`, название `RAG Desktop` и каталог `release-package/`;
- `npm run desktop:build` дополнительно запускает `scripts/build-installer.cjs`, где сейчас указаны `appId` `com.superchat.app`, название `Super Chat` и каталог `release-package/build-<timestamp>/`.

Обе конфигурации создают NSIS installer с выбором каталога установки, ярлыком на рабочем столе и ярлыком в меню Start. Перед публикацией installer рекомендуется выбрать одно название и один `appId` и синхронизировать `package.json` со `scripts/build-installer.cjs`.

Для подписи Windows installer задайте переменные окружения до запуска сборки. Пароль сертификата нельзя записывать в `package.json` или commit:

```powershell
$env:WIN_SIGNING_CERT = "C:\certs\certificate.pfx"
$env:WIN_SIGNING_CERT_PASSWORD = "<CERTIFICATE_PASSWORD>"
npm run desktop:build
```

## Локализация и темы

Интерфейс содержит языки English, Русский, Español, Français, Deutsch, 中文 и 日本語. Тема и выбранный режим DevTools сохраняются в `localStorage`. Provider names и технические сообщения могут оставаться на английском, если для конкретного ключа перевода нет локализованного значения.

## Проверка проекта

Рекомендуемый порядок проверки изменений:

```bash
npm run type-check
npm run build
npm run lint
```

На текущем состоянии `type-check` и `build` проходят. Команда `lint` требует конфигурацию формата ESLint 9 `eslint.config.js`, `eslint.config.mjs` или `eslint.config.cjs`; в репозитории сейчас сохранен старый формат `.eslintrc.cjs`, поэтому lint может завершаться ошибкой до миграции конфигурации.

## Технический стек

- Frontend: React 18, TypeScript и Vite;
- Desktop: Electron;
- Backend: Express 5, Node.js и TypeScript;
- UI: Tailwind CSS, Radix UI и `lucide-react`;
- состояние и настройки: React hooks, Zustand и localStorage;
- локальная обработка документов: модуль в `src/local-model/document-model/`.

## Устранение неполадок

- `Cannot connect to ...`: проверьте, что сервис запущен и Base URL указан без ошибки.
- `Authentication failed`: проверьте API key и сохраните настройки заново.
- `Endpoint not found`: убедитесь, что указан правильный API route, обычно с суффиксом `/v1`.
- `missing upstream credentials`: настройте upstream provider внутри OmniRoute или выберите прямого провайдера.
- `No models are configured`: добавьте хотя бы один model preset в `Settings` и выберите его активным.
- Ошибка загрузки файла: проверьте лимит 10 MB на файл и корректность multipart-запроса.

## Корректное использование

- Используйте только API keys и подписки, на которые у вас есть право.
- Не пытайтесь обходить лимиты, правила провайдеров или ограничения подписок.
- Не публикуйте реальные credentials в коде, README, issue, логах или commit-ах.
- Локальные endpoint-ы должны быть доступны только доверенным приложениям и пользователям.

## Ограничения и безопасность

- Настройки и история чата хранятся в памяти backend и не являются постоянной базой данных.
- В приложении нет отдельной пользовательской аутентификации; backend предназначен для локального использования.
- API keys передаются в runtime-настройках и не должны попадать в исходники или логи.
- OmniRoute требует собственных upstream credentials.
- RAG Management, импорт документов и semantic search пока не подключены к полноценному persistent vector store.
- Локальная модель ограничена алгоритмами, реализованными в `src/local-model/document-model/`.
- `release-package/`, `dist/` и другие результаты сборки не являются исходным кодом и должны пересобираться после изменений.
- В текущем upload-clean состоянии `node_modules/`, `dist/`, `release-package/` и `.vscode/` удалены. Для локального запуска после получения проекта выполните `npm install`.

## Историческая документация

Архивные заметки об OmniRoute находятся в `docs/archived/`. Они сохранены для справки и используют только placeholders вместо реальных credentials. Актуальные команды и состояние проекта описаны в этом README.