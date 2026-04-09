/* Content script — runs on every page.
 *
 * Currently minimal: listens for messages from the background script
 * to grab selected text. The popup also uses chrome.scripting.executeScript
 * to grab selections directly, so this script mainly serves as a hook
 * for future features (e.g., highlight-and-capture overlay).
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "get_selection") {
    sendResponse({ text: window.getSelection().toString() });
  }
});
