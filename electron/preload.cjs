const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isDesktop: true,
  setDevToolsMode: (mode) => ipcRenderer.invoke("desktop:set-devtools-mode", mode)
});
