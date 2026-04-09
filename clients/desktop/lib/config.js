const Store = require("electron-store");

const store = new Store({
  defaults: {
    apiUrl: "http://localhost:8000",
    apiKey: "",
    hotkey: "CommandOrControl+Shift+M",
  },
});

module.exports = {
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  getAll: () => ({
    apiUrl: store.get("apiUrl"),
    apiKey: store.get("apiKey"),
    hotkey: store.get("hotkey"),
  }),
  setAll: (settings) => {
    if (settings.apiUrl !== undefined) store.set("apiUrl", settings.apiUrl);
    if (settings.apiKey !== undefined) store.set("apiKey", settings.apiKey);
    if (settings.hotkey !== undefined) store.set("hotkey", settings.hotkey);
  },
};
