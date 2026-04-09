const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mailroom", {
  // Capture
  captureText: (text) => ipcRenderer.invoke("capture:text", text),
  captureFiles: (filePaths) => ipcRenderer.invoke("capture:files", filePaths),
  captureClipboard: () => ipcRenderer.invoke("capture:clipboard"),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  testConnection: () => ipcRenderer.invoke("settings:test"),

  // Events from main
  onCaptureResult: (callback) => {
    ipcRenderer.on("capture:result", (_event, result) => callback(result));
  },

  // File paths from drag-and-drop (Electron needs this for security)
  getFilePath: (file) => file.path,
});
