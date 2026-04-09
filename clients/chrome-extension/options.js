/* global chrome */

const apiUrlInput = document.getElementById("api-url");
const apiKeyInput = document.getElementById("api-key");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");

// Load saved settings
document.addEventListener("DOMContentLoaded", async () => {
  const { apiUrl, apiKey } = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  if (apiUrl) apiUrlInput.value = apiUrl;
  if (apiKey) apiKeyInput.value = apiKey;
});

// Save settings
saveBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (apiKey && !apiKey.startsWith("mr_")) {
    statusEl.textContent = "API key should start with mr_";
    statusEl.style.color = "#b91c1c";
    statusEl.style.display = "block";
    return;
  }

  await chrome.storage.sync.set({ apiUrl, apiKey });

  statusEl.textContent = "Saved!";
  statusEl.style.color = "#1a7a1a";
  statusEl.style.display = "block";
  setTimeout(() => {
    statusEl.style.display = "none";
  }, 2000);
});
