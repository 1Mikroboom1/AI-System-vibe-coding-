# RAG Desktop - Построение и запуск

Приложение готово к распространению как полнофункциональный desktop-бандл для Windows с встроенным backend-сервером.

## Архитектура Electron

```
electron/
├── main.cjs           # Electron main process (window + backend manager)
└── preload.cjs        # Secure context bridge to React app

src/
├── server/server.ts   # Express backend (exportable для встраивания)
├── App.tsx            # React frontend UI
└── ...                # остальные компоненты React
```

### Режимы работы

**Development (npm run desktop:dev)**
- Vite dev server на :3000 с HMR
- Express backend на :5000
- Electron окно подключается к http://localhost:3000
- DevTools открываются автоматически

**Production (npm run desktop:start)**
- Встроенный Express backend загружается в main process
- Загружается static dist/index.html из приложения
- Zero external dependencies для backend (всё в node_modules)

## Команды

### Локальная разработка

```bash
# Запуск frontend + backend + Electron с HMR
npm run desktop:dev
```

Откроется Electron окно, подключённое к Vite dev серверу на localhost:3000.

### Локальная проверка packaged app

```bash
# Компилирует backend и frontend, запускает как packaged приложение
npm run desktop:start
```

### Сборка installer

```bash
# Создаёт RAG-Desktop-Setup-1.0.0.exe в папке release/
npm run desktop:build
```

Запустится NSIS installer builder, который создаст полный установочный exe файл:
- Включает все бинарники (Node.js внутри Electron)
- Встроенный Express backend
- Клиентское приложение React
- Ярлыки на рабочем столе и в меню Пуск

## Дополнительные параметры Electron

### Подписание (Windows Code Signing)

Для распространения готового installer с подписью:

```bash
WIN_SIGNING_CERT=/path/to/cert.pfx \
WIN_SIGNING_CERT_PASSWORD=password \
npm run desktop:build
```

### Настройка NSIS installer

В package.json квартал "build.nsis":
- `oneClick`: false → требует выбор папки установки
- `allowToChangeInstallationDirectory`: true → пользователь выбирает куда установить
- `createDesktopShortcut`: true → добавляет ярлык на рабочий стол
- `createStartMenuShortcut`: true → добавляет в меню Пуск

## Структура распространения

**Файл installer**: `RAG-Desktop-Setup-1.0.0.exe` (~250 MB)

При установке создаётся:
```
C:\Users\{username}\AppData\Local\Programs\RAG Desktop\
├── electron/main.cjs
├── dist/
│   ├── index.html
│   ├── assets/
│   └── server/server.js (compiled backend)
├── node_modules/
└── resources/ (Electron runtime)
```

## Локализация портов

Проверьте в package.json что backend слушает на уникальном порту в production:
- **Development**: :3000 (frontend) + :5000 (backend)
- **Production/Packaged**: backend на 127.0.0.1:5000, frontend загружает static

Если нужны другие порты, отредактируйте:
- `src/server/server.ts` (PORT переменная окружения)
- `electron/main.cjs` (hardcoded 5000 для embedded версии)

## Отладка

### Desktop dev mode с DevTools

```bash
npm run desktop:dev
```

DevTools открываются автоматически в отдельном окне.

### Логирование backend

Backend логирует в console main process:
```javascript
console.log(`RAG Desktop API running on http://127.0.0.1:5000`);
```

## Развёртывание

### Автоматическое обновление (опционально)

Можно интегрировать electron-updater для автоматического обновления:

```bash
npm install electron-updater
```

Затем в `electron/main.cjs`:
```javascript
const { autoUpdater } = require("electron-updater");
autoUpdater.checkForUpdatesAndNotify();
```

---

**Готовое приложение** готово к распространению как .exe установщик на Windows.
