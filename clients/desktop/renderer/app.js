// --- DOM refs ---
const dropZone = document.getElementById("drop-zone");
const captureText = document.getElementById("capture-text");
const captureBtn = document.getElementById("capture-btn");
const clipboardBtn = document.getElementById("clipboard-btn");
const settingsBtn = document.getElementById("settings-btn");
const openSettingsLink = document.getElementById("open-settings-link");
const setupBanner = document.getElementById("setup-banner");
const statusEl = document.getElementById("status");

// --- Init ---
window.addEventListener("DOMContentLoaded", async () => {
  const settings = await window.mailroom.getSettings();
  if (!settings.apiKey) {
    setupBanner.style.display = "flex";
  }

  // Listen for results from main process (e.g., clipboard capture via hotkey)
  window.mailroom.onCaptureResult((result) => {
    showStatus(result.message, result.success ? "success" : "error");
  });
});

// --- Drag and drop ---
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("drag-over");

  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;

  const filePaths = files.map((f) => f.path).filter(Boolean);
  if (filePaths.length === 0) {
    showStatus("Could not read file paths.", "error");
    return;
  }

  dropZone.classList.add("uploading");
  showStatus(`Uploading ${filePaths.length} file${filePaths.length > 1 ? "s" : ""}...`, "loading");

  try {
    const result = await window.mailroom.captureFiles(filePaths);
    showStatus(result.message, result.success ? "success" : "error");
  } catch (err) {
    showStatus(err.message || "Upload failed.", "error");
  } finally {
    dropZone.classList.remove("uploading");
  }
});

// Prevent default drag behavior on the whole window
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());

// --- Quick text capture ---
captureBtn.addEventListener("click", async () => {
  const text = captureText.value.trim();
  if (!text) {
    showStatus("Enter some text to capture.", "error");
    return;
  }

  captureBtn.disabled = true;
  showStatus("Sending...", "loading");

  try {
    const result = await window.mailroom.captureText(text);
    showStatus(result.message, result.success ? "success" : "error");
    if (result.success) captureText.value = "";
  } catch (err) {
    showStatus(err.message || "Capture failed.", "error");
  } finally {
    captureBtn.disabled = false;
  }
});

// --- Clipboard capture ---
clipboardBtn.addEventListener("click", async () => {
  showStatus("Capturing clipboard...", "loading");
  await window.mailroom.captureClipboard();
});

// --- Settings (inline prompt) ---
async function openSettings() {
  const settings = await window.mailroom.getSettings();
  const key = prompt("Enter your Mailroom API key (mr_...):", settings.apiKey || "");
  if (key !== null) {
    await window.mailroom.saveSettings({ apiKey: key });
    if (key) {
      setupBanner.style.display = "none";
      showStatus("API key saved!", "success");
    } else {
      setupBanner.style.display = "flex";
    }
  }
}

settingsBtn.addEventListener("click", openSettings);

openSettingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  openSettings();
});

// --- Status ---
function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  statusEl.style.display = "block";

  if (type === "success") {
    setTimeout(() => {
      statusEl.style.display = "none";
    }, 3000);
  }
}
