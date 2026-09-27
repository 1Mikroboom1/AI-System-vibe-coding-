# 🚀 Запуск и проверка OmniRoute интеграции

## Шаг 1: Убедиться что все скомпилировалось

```bash
# Проверить типы
npm run type-check

# Результат должен быть:
# (пусто = успешно)
```

```bash
# Собрать проект
npm run build

# Результат:
# ✓ 35 modules transformed.
# ✓ built in 1.27s
```

## Шаг 2: Запустить OmniRoute

```bash
# Терминал 1: Запустить OmniRoute
omniroute

# Вывод:
# OmniRoute is running on http://localhost:20128
```

## Шаг 3: Запустить приложение в dev режиме

```bash
# Терминал 2: Запустить приложение
npm run dev

# Вывод:
# VITE v6.4.2  ready in 1234 ms
#
# ➜  Local:   http://localhost:5173
# ➜  press h to show help
```

**Или запустить собранный бекенд:**

```bash
# Терминал 2: Запустить бекенд
node dist/server/server.cjs

# Вывод:
# RAG Desktop API running on http://0.0.0.0:5000
```

## Шаг 4: Тестировать подключение (CLI)

```bash
# Терминал 3: Запустить тест
node test-omniroute.js

# Вывод:
# 🧪 OmniRoute Connection Test
# 
# Base URL: http://localhost:20128/v1
# API Key: <OMNIROUTE_API_KEY>
# 
# 🔍 Checking connectivity to localhost:20128...
# ✓ Host is reachable
# 
# 📤 Sending test message...
# ✓ HTTP Status: 200 OK
# ✓ Content-Type: application/json
# 
# 📥 Response received:
# "Connection successful!"
# 
# ✅ Connection successful!
# 
# ═══════════════════════════════════════════════
# 🎉 All tests passed! Ready to use OmniRoute.
# ═══════════════════════════════════════════════
```

## Шаг 5: Протестировать в приложении

### Вариант A: Web (Vite)

1. Открыть браузер: http://localhost:5173
2. Перейти на Settings
3. Выбрать "OmniRoute" из dropdown
4. Ввести параметры:
   - Base URL: `http://localhost:20128/v1`
  - API Key: `<OMNIROUTE_API_KEY>`
5. Нажать "Test Connection"
   - Должно появиться ✅ "Successfully connected to OmniRoute"
6. Нажать "Save API Settings"
7. Перейти на Chat
8. Написать вопрос и отправить

### Вариант B: Electron (если есть)

1. Открыть приложение
2. Нажать Settings
3. Следовать шагам 3-8 выше

## Проверка логов

### Backend логи

```
[CHAT] Provider call initiated: OmniRoute
[CHAT] Chat endpoint response sent
```

### Browser DevTools

1. Открыть F12
2. Network tab
3. Найти запросы:
   - `POST /api/settings` - сохранение параметров
   - `POST /api/omniroute/test` - тестирование
   - `POST /api/rag/chat` - отправка сообщения

## Возможные проблемы и решения

### Проблема 1: "omniroute command not found"

**Решение:**
```bash
# Установить OmniRoute глобально
npm install -g omniroute

# Или запустить локально
npx omniroute
```

### Проблема 2: "Cannot connect to OmniRoute server"

**Решение:**
```bash
# Убедиться что OmniRoute запущен
ps aux | grep omniroute

# Проверить слушает ли порт 20128
netstat -an | grep 20128

# Или использовать curl
curl http://localhost:20128
```

### Проблема 3: "Invalid Base URL format"

**Решение:**
- ✅ Правильно: `http://localhost:20128/v1`
- ❌ Неправильно: `http://localhost:20128` (без /v1)
- ❌ Неправильно: `localhost:20128/v1` (без http://)

### Проблема 4: "API Key is invalid"

**Решение:**
```bash
# Убедиться что ключ правильный
# В OmniRoute dashboard → Endpoints → Registered Keys
# Скопировать ключ полностью без пробелов
```

### Проблема 5: "Non-JSON response"

**Решение:**
- Проверить что URL заканчивается на `/v1/chat/completions`
- Убедиться что OmniRoute запущен
- Проверить что Base URL указан правильно

## Полные команды для копирования

### Linux / macOS

```bash
# Терминал 1
omniroute

# Терминал 2
npm run dev

# Терминал 3
node test-omniroute.js
```

### Windows PowerShell

```powershell
# Терминал 1
omniroute

# Терминал 2
npm run dev

# Терминал 3
node test-omniroute.js
```

## Проверка компонентов

### 1. Frontend готов?
- [ ] `npm run build` проходит ✓
- [ ] `npm run type-check` без ошибок ✓
- [ ] UI Settings показывает "OmniRoute" опцию ✓
- [ ] Кнопка "Test Connection" видна ✓

### 2. Backend готов?
- [ ] `npm run build:server` проходит ✓
- [ ] `/api/omniroute/test` endpoint существует ✓
- [ ] `/api/rag/chat` endpoint работает ✓
- [ ] Импорты из `providers.ts` работают ✓

### 3. Интеграция готова?
- [ ] `sendMessage()` функция работает ✓
- [ ] `testOmniRouteConnection()` функция работает ✓
- [ ] `useOmniRouteTest()` хук работает ✓
- [ ] SettingsPage отображает результаты ✓

## Детальная проверка каждого компонента

### Проверка sendMessage()

```bash
# Создать тест файл: test-send-message.js
```

```javascript
const { sendMessage } = require('./dist/server/server.cjs');

sendMessage(
  'http://localhost:20128/v1',
  '<OMNIROUTE_API_KEY>',
  {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Test' }]
  }
).then(response => {
  console.log('✅ Success:', response);
}).catch(error => {
  console.error('❌ Error:', error.message);
});
```

```bash
node test-send-message.js
```

### Проверка testOmniRouteConnection()

```bash
# Создать тест файл: test-connection.js
```

```javascript
const { testOmniRouteConnection } = require('./dist/server/server.cjs');

testOmniRouteConnection(
  'http://localhost:20128/v1',
  '<OMNIROUTE_API_KEY>'
).then(result => {
  console.log('Status:', result.status);
  console.log('Message:', result.message);
  if (result.details) console.log('Details:', result.details);
});
```

```bash
node test-connection.js
```

## Финальная проверка

```bash
# 1. Type check
npm run type-check
# ✓ Success

# 2. Build
npm run build
# ✓ built in 1.27s

# 3. Test
node test-omniroute.js
# 🎉 All tests passed!

# 4. Dev server
npm run dev
# ➜ ready in 1234 ms
```

**Если все ✓ - готово к использованию!**

## Что дальше?

1. ✅ Убедиться что все работает локально
2. ✅ Настроить необходимые провайдеры в OmniRoute
3. ✅ Создать API ключ в OmniRoute
4. ✅ Начать использовать в приложении
5. ✅ Развернуть на продакшене (если нужно)

---

**Быстрые ссылки:**
- Быстрый старт: `KIRO_OMNIROUTE_QUICK_START.md`
- Полная документация: `OMNIROUTE_INTEGRATION.md`
- Шпаргалка кода: `OMNIROUTE_CHEATSHEET.md`
- Тестовый скрипт: `test-omniroute.js`
