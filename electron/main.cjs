const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

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

ipcMain.handle("desktop:select-directory", async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow || null;
  const result = await dialog.showOpenDialog(targetWindow || undefined, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select directory"
  });

  if (result.canceled || !result.filePaths?.length) {
    return null;
  }

  return result.filePaths[0];
});

async function startEmbeddedBackend() {
  // Try multiple locations because build output layout can vary between environments.
  const candidates = [];
  if (app.isPackaged) {
    const appPath = app.getAppPath();
    candidates.push(path.join(appPath, "dist", "server", "server", "server.js"));
    candidates.push(path.join(appPath, "dist", "server", "server.js"));
    candidates.push(path.join(appPath, "dist", "server", "server.cjs"));
  } else {
    const devDist = path.join(__dirname, "..", "dist", "server");
    candidates.push(path.join(devDist, "server", "server.js"));
    candidates.push(path.join(devDist, "server.js"));
    candidates.push(path.join(devDist, "server.cjs"));
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
  let serverModule;
  if (serverModulePath.endsWith(".cjs")) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    serverModule = require(serverModulePath);
  } else {
    serverModule = await import(pathToFileURL(serverModulePath).href);
  }

  const startServer =
    serverModule.startServer ||
    (serverModule.default && serverModule.default.startServer) ||
    serverModule.default;

  if (typeof startServer !== "function") {
    throw new Error(`startServer export not found in ${serverModulePath}`);
  }

  console.log("Server module loaded, starting on port 5000...");
  backendServer = startServer({
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
  
  // Use app.getAppPath() which correctly resolves inside ASAR
  const distPath = path.join(app.getAppPath(), "dist");
  const indexPath = path.join(distPath, "index.html");
  console.log("Index path:", indexPath);
  console.log("File exists:", fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    console.log("Loading file:", indexPath);
    // Use file:// protocol with path instead of loadFile for better compatibility
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
