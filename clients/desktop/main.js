const path = require("path");
const {
  app,
  BrowserWindow,
  Tray,
  globalShortcut,
  clipboard,
  Notification,
  ipcMain,
  nativeImage,
  screen,
} = require("electron");

const config = require("./lib/config");
const api = require("./lib/api");

let tray = null;
let mainWindow = null;

// ---------------------------------------------------------------------------
// App ready
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createTray();
  createMainWindow();
  registerHotkey();
  console.log("Mailroom Desktop ready");
});

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  const iconPath = path.join(__dirname, "assets", "trayIconTemplate.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    // Resize to standard tray size if needed
    icon = icon.resize({ width: 18, height: 18 });
    icon.setTemplateImage(true);
  } catch {
    // Fallback: create a simple 18x18 icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Mailroom — Drag & Drop Capture");

  tray.on("click", (_event, bounds) => {
    toggleWindow(bounds);
  });

  tray.on("right-click", (_event, bounds) => {
    toggleWindow(bounds);
  });
}

// ---------------------------------------------------------------------------
// Main window (dropdown from tray)
// ---------------------------------------------------------------------------

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 440,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Hide when clicking away
  mainWindow.on("blur", () => {
    mainWindow.hide();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

function toggleWindow(trayBounds) {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  // Position window below the tray icon
  const windowBounds = mainWindow.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);

  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
}

// ---------------------------------------------------------------------------
// Global hotkey — clipboard capture
// ---------------------------------------------------------------------------

function registerHotkey() {
  const hotkey = config.get("hotkey") || "CommandOrControl+Shift+M";
  try {
    globalShortcut.unregisterAll();
    globalShortcut.register(hotkey, async () => {
      await handleClipboardCapture();
    });
  } catch (err) {
    console.error("Failed to register hotkey:", err.message);
  }
}

async function handleClipboardCapture() {
  const settings = config.getAll();
  if (!settings.apiKey) {
    showNotification("Mailroom", "Set your API key first.", false);
    return;
  }

  const text = clipboard.readText();
  const image = clipboard.readImage();

  if (text) {
    try {
      await api.captureText(settings.apiUrl, settings.apiKey, text);
      showNotification("Mailroom", "Clipboard text captured!", true);
      sendResultToRenderer({ success: true, message: "Clipboard captured!" });
    } catch (err) {
      showNotification("Mailroom", `Failed: ${err.message}`, false);
      sendResultToRenderer({ success: false, message: err.message });
    }
  } else if (!image.isEmpty()) {
    const fs = require("fs");
    const os = require("os");
    const tmpPath = path.join(os.tmpdir(), `mailroom-clip-${Date.now()}.png`);
    fs.writeFileSync(tmpPath, image.toPNG());
    try {
      await api.captureFiles(settings.apiUrl, settings.apiKey, [tmpPath]);
      showNotification("Mailroom", "Clipboard image captured!", true);
      sendResultToRenderer({ success: true, message: "Clipboard image captured!" });
    } catch (err) {
      showNotification("Mailroom", `Failed: ${err.message}`, false);
      sendResultToRenderer({ success: false, message: err.message });
    } finally {
      fs.unlinkSync(tmpPath);
    }
  } else {
    showNotification("Mailroom", "Nothing on clipboard.", false);
  }
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

/**
 * Run a capture action with settings validation and error handling.
 * @param {Function} action — async (apiUrl, apiKey) => successMessage
 * @returns {{ success: boolean, message: string }}
 */
async function runCapture(action) {
  const { apiUrl, apiKey } = config.getAll();
  if (!apiKey) return { success: false, message: "API key not configured" };
  try {
    const msg = await action(apiUrl, apiKey);
    showNotification("Mailroom", msg, true);
    return { success: true, message: msg };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

ipcMain.handle("capture:text", async (_event, text) => {
  return runCapture(async (url, key) => {
    await api.captureText(url, key, text);
    return "Captured!";
  });
});

ipcMain.handle("capture:files", async (_event, filePaths) => {
  return runCapture(async (url, key) => {
    await api.captureFiles(url, key, filePaths);
    const n = filePaths.length;
    return `${n} file${n > 1 ? "s" : ""} captured!`;
  });
});

ipcMain.handle("capture:clipboard", async () => {
  await handleClipboardCapture();
  return { success: true };
});

ipcMain.handle("settings:get", () => config.getAll());

ipcMain.handle("settings:save", (_event, settings) => {
  config.setAll(settings);
  registerHotkey();
  return { success: true };
});

ipcMain.handle("settings:test", async () => {
  const settings = config.getAll();
  try {
    const result = await api.testConnection(settings.apiUrl);
    return { success: true, message: `Connected (v${result.version})` };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// ---------------------------------------------------------------------------
// Notifications & helpers
// ---------------------------------------------------------------------------

function showNotification(title, body, success) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  if (tray) {
    tray.setTitle(success ? " \u2713" : " !");
    setTimeout(() => tray.setTitle(""), 2000);
  }
}

function sendResultToRenderer(result) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("capture:result", result);
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// Keep running as menubar app
app.on("window-all-closed", (e) => {
  e.preventDefault();
});

// macOS: clicking dock icon opens the capture window
app.on("activate", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Show centered on screen instead of under tray
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    const winBounds = mainWindow.getBounds();
    const x = Math.round((width - winBounds.width) / 2);
    const y = Math.round((height - winBounds.height) / 2);
    mainWindow.setPosition(x, y, false);
    mainWindow.show();
    mainWindow.focus();
  }
});

// macOS: show in dock with app icon
// The app lives in both the menubar tray AND the dock
