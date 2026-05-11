# Инструкция по настройке билда приложения

Этот файл содержит полное руководство по кастомизации и сборке RAG Desktop приложения для распространения.

## Быстрый старт

Для сборки installer используй:
```bash
npm run desktop:build
```

Результат: `release/RAG-Desktop-Setup-1.0.0.exe`

## 1. Названия и версии

### package.json
```json
{
  "name": "rag-desktop",
  "version": "1.0.0",
  "productName": "RAG Desktop",
  "description": "Multi-provider AI chat desktop app"
}
```

- `name` — используется в npm (оставь как есть)
- `productName` — название приложения в Windows (видно пользователю)
- `version` — версия в семантике X.Y.Z
- `description` — краткое описание в Store и installer

**Примеры:**
```json
"productName": "MyAI Assistant",
"version": "2.1.0"
```

После изменения переберай bildер:
```bash
npm run desktop:build
```

## 2. Иконки

### Расположение файлов

```
build/
├── icon.png          # 512x512 (для Windows и веб)
├── icon.ico          # Конвертированная ico версия
└── icon.icns         # macOS (опционально)
```

### Создание иконки

1. **Подготовь PNG 512x512** без альфа-канала (закрашенный фон)

2. **Конвертируй в ICO** (Windows):
   ```bash
   # Используя ImageMagick:
   convert build/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 build/icon.ico
   ```

   Или используй онлайн-конвертер: https://convertio.co/ru/png-ico/

3. **Обнови путь в package.json** (если нужно):
   ```json
   "build": {
     "win": {
       "icon": "build/icon.ico"
     }
   }
   ```

### Текущая конфигурация

```json
{
  "build": {
    "appId": "com.rag-desktop.app",
    "productName": "RAG Desktop",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico",
      "certificateFile": null,
      "certificatePassword": null
    }
  }
}
```

После обновления иконки:
```bash
npm run desktop:build
```

## 3. Информация об приложении

### Описание и автор

**package.json**
```json
{
  "author": "Your Name <your@email.com>",
  "homepage": "https://yoursite.com"
}
```

**electron/main.cjs**
```javascript
const appVersion = "1.0.0";
const appName = "RAG Desktop";
```

### About меню (опционально)

Если добавить About диалог, отредактируй в `electron/main.cjs`:

```javascript
const aboutWindow = () => {
  const about = new BrowserWindow({
    width: 400,
    height: 300,
    parent: mainWindow,
    modal: true
  });
  about.loadFile("about.html");
};
```

## 4. NSIS Installer (Windows)

### Основные параметры

**package.json → build.nsis**

```json
{
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "RAG Desktop"
  }
}
```

| Параметр | Значение | Описание |
|----------|---------|---------|
| `oneClick` | true/false | Быстрая установка (true) или с выбором папки (false) |
| `allowToChangeInstallationDirectory` | true/false | Позволить пользователю выбрать папку |
| `createDesktopShortcut` | true/false | Создать ярлык на рабочий стол |
| `createStartMenuShortcut` | true/false | Создать в меню Пуск |
| `shortcutName` | "string" | Название ярлыка |

### Пример полной конфигурации

```json
{
  "build": {
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "RAG Desktop",
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "include": "installer-script.nsi"
    }
  }
}
```

## 5. Подписание кода (Code Signing)

### Для распространения подписанного installer

Требуется сертификат Code Signing для Windows. 

#### Способ 1: Через переменные окружения

```bash
$env:WIN_SIGNING_CERT = "C:\certs\certificate.pfx"
$env:WIN_SIGNING_CERT_PASSWORD = "your-password"
npm run desktop:build
```

#### Способ 2: В package.json

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "password",
      "signingHashAlgorithms": ["sha256"]
    }
  }
}
```

**Важно:** Не коммитьте пароли в git! Используй переменные окружения.

## 6. Информация в installer

### Лицензия

1. Создай файл `LICENSE` в корне проекта
2. Добавь в package.json:

```json
{
  "build": {
    "nsis": {
      "license": "LICENSE"
    }
  }
}
```

### Финальный экран установки

Отредактируй `installer-script.nsi` (если требуется):
```nsi
;This will be in the installer/uninstaller's title bar
Name "RAG Desktop"
OutFile "RAG-Desktop-Setup-1.0.0.exe"
```

## 7. Порты и API базовые URL

### Backend порт

**electron/main.cjs** (для packaged приложения)
```javascript
const backendPort = process.env.PORT || 5000;
const backendUrl = `http://127.0.0.1:${backendPort}`;
```

**src/server/server.ts** (для web версии)
```typescript
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

Если нужен другой порт, установи переменную окружения:
```bash
set PORT=8080
npm run desktop:build
```

## 8. Полный процесс кастомизации

### Чек-лист перед сборкой

- [ ] Обновил версию в `package.json` → `version`
- [ ] Обновил `productName` в `package.json`
- [ ] Добавил/обновил иконку `build/icon.ico`
- [ ] Обновил `author` в `package.json`
- [ ] Проверил NSIS параметры в `build.nsis`
- [ ] Добавил LICENSE файл (если требуется)
- [ ] Протестировал `npm run desktop:dev` локально
- [ ] Запустил `npm run type-check` и `npm run build` для проверки ошибок

### Финальная сборка

```bash
# Проверяем build
npm run build

# Собираем installer
npm run desktop:build

# Результат в:
# release/RAG-Desktop-Setup-1.0.0.exe
```

## 9. Примеры конфигураций

### Минималистичный (быстрая установка)

```json
{
  "productName": "MyApp",
  "version": "1.0.0",
  "build": {
    "nsis": {
      "oneClick": true,
      "createDesktopShortcut": true
    }
  }
}
```

### Профессиональный (с выбором папки и лицензией)

```json
{
  "productName": "Professional App",
  "version": "2.0.0",
  "author": "Company <contact@company.com>",
  "build": {
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "license": "LICENSE",
      "shortcutName": "Professional App"
    },
    "win": {
      "certificateFile": "cert.pfx",
      "signingHashAlgorithms": ["sha256"]
    }
  }
}
```

## 10. Отладка

### Если installer не создаётся

```bash
# Проверь, что build папка существует
ls dist/

# Проверь версию electron-builder
npm list electron-builder

# Пересборка с логами
npm run desktop:build -- --verbose
```

### Если иконка не отображается

```bash
# Убедись, что path правильный (относительный от корня)
# и что файл существует
test-path build/icon.ico

# Пересборка
npm run desktop:build
```

## 11. Автоматическое обновление (Advanced)

Если нужны автообновления, установи:

```bash
npm install electron-updater
```

Затем в `electron/main.cjs`:

```javascript
const { autoUpdater } = require("electron-updater");

app.on("ready", () => {
  autoUpdater.checkForUpdatesAndNotify();
});
```

---

**Для вопросов**: см. [DESKTOP.md](DESKTOP.md) или [README.md](README.md)
