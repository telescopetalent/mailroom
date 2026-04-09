/* global chrome */

const DEFAULT_API_URL = "http://localhost:8000";

// --- Context menu setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "mailroom-send-selection",
    title: "Send to Mailroom",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "mailroom-send-page",
    title: "Send page to Mailroom",
    contexts: ["page"],
  });
});

// --- Context menu handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text =
    info.menuItemId === "mailroom-send-selection"
      ? info.selectionText
      : `[Page] ${tab.title}\n${tab.url}`;

  if (!text) return;

  const { apiKey, apiUrl } = await chrome.storage.sync.get(["apiKey", "apiUrl"]);
  if (!apiKey) {
    // Open options if not configured
    chrome.runtime.openOptionsPage();
    return;
  }

  const baseUrl = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");

  try {
    const body = {
      source: "chrome_extension",
      content_text: text,
      mode: "ai",
      source_ref: {
        url: tab.url,
        title: tab.title,
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

    if (resp.ok) {
      setBadge("✓", "#1a7a1a");
      setTimeout(() => clearBadge(), 2000);
    } else {
      setBadge("!", "#b91c1c");
      setTimeout(() => clearBadge(), 3000);
    }
  } catch {
    setBadge("!", "#b91c1c");
    setTimeout(() => clearBadge(), 3000);
  }
});

// --- Badge helpers ---
function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

// --- Listen for messages from popup ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "capture_sent") {
    setBadge("✓", "#1a7a1a");
    setTimeout(() => clearBadge(), 2000);
  }
});
