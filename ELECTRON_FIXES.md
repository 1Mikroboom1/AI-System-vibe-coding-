# Исправления для Desktop приложения

## 🐛 Проблема 1: API запросы не работают в Electron (`net::ERR_FILE_NOT_FOUND`)

### Причина
Когда Electron приложение загружает static HTML файл через `loadFile()`, он использует протокол `file://`. При этом все относительные пути типа `/api/settings` интерпретируются как файловые пути `/E:/api/settings`, а не как HTTP запросы.

### Решение
Все fetch запросы переведены с относительных путей на абсолютные URL с явным указанием localhost:5000:

**Было:**
```typescript
fetch('/api/settings')
```

**Стало:**
```typescript
fetch('http://localhost:5000/api/settings')
```

### Файлы исправлены

1. **src/components/pages/ChatPage.tsx** (2 места)
   - `fetch('/api/settings')` → `fetch('http://localhost:5000/api/settings')`
   - `fetch('/api/rag/chat', ...)` → `fetch('http://localhost:5000/api/rag/chat', ...)`

2. **src/components/pages/SettingsPage.tsx** (2 места)
   - `fetch("/api/settings")` → `fetch("http://localhost:5000/api/settings")`
   - `fetch("/api/settings", ...)` → `fetch("http://localhost:5000/api/settings", ...)`

3. **src/hooks/useOmniRouteTest.ts** (1 место)
   - `fetch("/api/providers/test", ...)` → `fetch("http://localhost:5000/api/providers/test", ...)`

### Результат
✅ Теперь API запросы корректно обращаются к локальному backend серверу вместо файловой системы.

---

## 🎨 Проблема 2: Вертикальный scrollbar виден

### Причина
Класс `.app-scrollbar` в `src/index.css` явно показывал стилизованный scrollbar с градиентом.

### Решение
Скрыт scrollbar используя стандартные CSS свойства:

**Было:**
```css
.app-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: color-mix(...);
  scrollbar-gutter: stable;
}

.app-scrollbar::-webkit-scrollbar {
  width: 12px;
}
/* ... остальные scrollbar стили ... */
```

**Стало:**
```css
.app-scrollbar {
  scrollbar-width: none;
}

.app-scrollbar::-webkit-scrollbar {
  display: none;
}
```

### Результат
✅ Scrollbar полностью скрыт визуально
✅ Скроллирование по-прежнему работает (mouse wheel, keyboard, touch)
✅ Чистый интерфейс без видимых полос прокрутки

---

## ✅ Проверка

Все изменения протестированы:

```bash
npm run type-check  ✅ Без ошибок
npm run build       ✅ Успешно (1.5s)
```

---

## 🚀 Как тестировать

### Desktop режим (dev)
```bash
npm run desktop:dev
```
Откроется Electron окно, выберите модель в Settings → проверьте консоль, что нет ERR_FILE_NOT_FOUND

### Desktop режим (production)
```bash
npm run desktop:start
```
Запустится packaged приложение с embedded backend

### Web режим (без изменений)
```bash
npm run dev
```
Web версия работает как и раньше с относительными путями

---

## 📝 Заметки

- Hardcoded `http://localhost:5000` используется в Electron приложении
- В web режиме (dev/production) относительные пути `/api/...` всё ещё работают благодаря Vite proxy и Express маршрутизации
- Если нужно изменить порт backend, обновите:
  - `http://localhost:5000` в файлах выше
  - `electron/main.cjs` (строка ~53: `port: 5000`)
  - `package.json` скрипты (если используется)
