/* global chrome */

const DEFAULT_API_URL = "http://localhost:8000";

// --- DOM refs ---
const captureText = document.getElementById("capture-text");
const pageUrl = document.getElementById("page-url");
const pageTitle = document.getElementById("page-title");
const sendBtn = document.getElementById("send-btn");
const statusEl = document.getElementById("status");
const setupBanner = document.getElementById("setup-banner");
const openOptions = document.getElementById("open-options");
const modeButtons = document.querySelectorAll(".mode-btn");

let currentMode = "ai";

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  // Load settings and check config
  const { apiKey } = await chrome.storage.sync.get("apiKey");
  if (!apiKey) {
    setupBanner.style.display = "flex";
  }

  // Fill page info from active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    pageUrl.value = tab.url || "";
    pageTitle.value = tab.title || "";
  }

  // Check if there's selected text from the page
  if (tab?.id) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString(),
      });
      if (result?.result) {
        captureText.value = result.result;
      }
    } catch {
      // Can't inject into chrome:// or extension pages — ignore
    }
  }
});

// --- Mode toggle ---
modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
  });
});

// --- Open options ---
openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// --- Send capture ---
sendBtn.addEventListener("click", async () => {
  const text = captureText.value.trim();
  if (!text) {
    showStatus("Enter some content to capture.", "error");
    return;
  }

  const { apiKey, apiUrl } = await chrome.storage.sync.get(["apiKey", "apiUrl"]);
  if (!apiKey) {
    showStatus("Set your API key in Settings first.", "error");
    return;
  }

  const baseUrl = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");

  sendBtn.disabled = true;
  showStatus("Sending...", "loading");

  try {
    const body = {
      source: "chrome_extension",
      content_text: text,
      mode: currentMode,
      source_ref: {
        url: pageUrl.value,
        title: pageTitle.value,
      },
    };

    const resp = await fetch(`${baseUrl}/api/v1/captures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || err.detail || `HTTP ${resp.status}`);
    }

    showStatus("Captured! Check your Mailroom inbox.", "success");
    captureText.value = "";

    // Update badge
    chrome.runtime.sendMessage({ type: "capture_sent" });
  } catch (err) {
    showStatus(err.message || "Failed to send capture.", "error");
  } finally {
    sendBtn.disabled = false;
  }
});

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
