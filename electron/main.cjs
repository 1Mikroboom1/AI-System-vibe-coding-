const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let backendServer = null;

function applyDevToolsMode(mode) {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  if (mode === "off") {
    mainWindow.webContents.closeDevTools();
    return;
  }

  mainWindow.webContents.openDevTools({ mode: mode === "right" ? "right" : "detach" });
}

ipcMain.handle("desktop:set-devtools-mode", (_event, mode) => {
  applyDevToolsMode(mode);
  return mode;
});

async function startEmbeddedBackend() {
  // Try multiple locations for the server when packaged:
  // 1) resources/dist/server (if copied via extraResources)
  // 2) app.asar.unpacked/dist/server (if asarUnpack created it)
  // 3) relative to __dirname (works in dev and sometimes in asar)
  // Server files are renamed to .cjs so they are treated as CommonJS in ESM projects
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "app.asar", "dist", "server", "server.cjs"));
  } else {
    candidates.push(path.join(__dirname, "..", "dist", "server", "server.cjs"));
  }

  let serverModulePath = null;
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        serverModulePath = c;
        break;
      }
    } catch (err) {
      // ignore
    }
  }

  if (!serverModulePath) {
    console.error("Server module not found in candidates:", candidates);
    throw new Error("Server module not found");
  }

  console.log("Loading server from:", serverModulePath);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const serverModule = require(serverModulePath);
  console.log("Server module loaded, starting on port 5000...");
  backendServer = serverModule.startServer({
    port: 5000,
    host: "127.0.0.1",
    serveStatic: false
  });
  console.log("Backend server started");
}

async function createMainWindow() {
  const isDev = !app.isPackaged;
  console.log("Creating main window, isDev:", isDev);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Attach webContents event listeners to capture renderer errors and loading failures
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error("Renderer failed to load:", { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  mainWindow.webContents.on("crashed", (event) => {
    console.error("Renderer crashed", event);
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.error("Renderer became unresponsive");
  });

  mainWindow.webContents.on("console-message", (e, level, message, line, sourceId) => {
    console.log(`Renderer console [${level}] ${sourceId}:${line} - ${message}`);
  });

  if (isDev) {
    console.log("Dev mode: loading http://localhost:3000");
    await mainWindow.loadURL("http://localhost:3000");
    return;
  }

  console.log("Production mode: starting embedded backend");
  await startEmbeddedBackend();
  const distPath = path.join(__dirname, "..", "dist");
  const indexPath = path.join(distPath, "index.html");
  console.log("Index path:", indexPath);
  console.log("File exists:", fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    console.log("Loading file:", indexPath);
    await mainWindow.loadFile(indexPath);
    console.log("File loaded");
  } else {
    console.error("Index file not found:", indexPath);
    mainWindow.webContents.loadURL("about:blank");
  }
}

app.whenReady().then(async () => {
  console.log("App ready, creating main window");
  try {
    await createMainWindow();
    console.log("Main window created successfully");
  } catch (error) {
    console.error("Failed to create main window:", error);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (backendServer && typeof backendServer.close === "function") {
    backendServer.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
