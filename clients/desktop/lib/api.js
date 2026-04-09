const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

/**
 * Guess MIME type from file extension.
 */
function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * Send a text capture to the Mailroom API.
 */
async function captureText(apiUrl, apiKey, text) {
  const baseUrl = apiUrl.replace(/\/+$/, "");

  const resp = await fetch(`${baseUrl}/api/v1/captures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      source: "desktop",
      content_text: text,
      mode: "ai",
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || err.detail || `HTTP ${resp.status}`);
  }

  return resp.json();
}

/**
 * Upload files to the Mailroom API.
 */
async function captureFiles(apiUrl, apiKey, filePaths) {
  const baseUrl = apiUrl.replace(/\/+$/, "");

  if (filePaths.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} files allowed`);
  }

  // Validate files
  for (const fp of filePaths) {
    const mime = mimeFromExt(fp);
    if (!ALLOWED_TYPES.has(mime)) {
      throw new Error(`Unsupported file type: ${path.basename(fp)}`);
    }
    const stat = fs.statSync(fp);
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (>10MB): ${path.basename(fp)}`);
    }
  }

  const form = new FormData();
  form.append("metadata", JSON.stringify({ source: "desktop" }));

  for (const fp of filePaths) {
    form.append("files", fs.createReadStream(fp), {
      filename: path.basename(fp),
      contentType: mimeFromExt(fp),
    });
  }

  const resp = await fetch(`${baseUrl}/api/v1/captures/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || err.detail || `HTTP ${resp.status}`);
  }

  return resp.json();
}

/**
 * Test the API connection.
 */
async function testConnection(apiUrl) {
  const baseUrl = apiUrl.replace(/\/+$/, "");
  const resp = await fetch(`${baseUrl}/api/v1/health`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

module.exports = { captureText, captureFiles, testConnection };
