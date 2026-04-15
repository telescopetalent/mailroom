import { useState, useEffect } from "react";
import { Image, FileText, FileIcon, Link2, ExternalLink, X, Download } from "lucide-react";
import { getApiKey } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

interface MediaSectionProps {
  captureId: string;
  attachments: Attachment[];
  normalizedText: string | null;
}

function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  return [...new Set(matches)];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function attachmentUrl(captureId: string, attachmentId: string): string {
  return `${API_BASE}/captures/${captureId}/attachments/${attachmentId}/download`;
}

/** Fetches an attachment as a blob URL using Bearer auth */
function useAuthBlobUrl(captureId: string, attachmentId: string): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = getApiKey();
    const url = attachmentUrl(captureId, attachmentId);
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    fetch(url, { headers })
      .then((r) => r.blob())
      .then((blob) => setBlobUrl(URL.createObjectURL(blob)))
      .catch(() => {});

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [captureId, attachmentId]);

  return blobUrl;
}

function ImageThumbnail({ captureId, attachment, onExpand }: { captureId: string; attachment: Attachment; onExpand: (url: string) => void }) {
  const blobUrl = useAuthBlobUrl(captureId, attachment.id);

  return (
    <button
      onClick={() => blobUrl && onExpand(blobUrl)}
      className="group relative w-32 h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer bg-zinc-100 dark:bg-zinc-800 p-0 hover:border-violet-500 transition-colors"
    >
      {blobUrl ? (
        <img src={blobUrl} alt={attachment.filename} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Image className="w-6 h-6 text-zinc-400 animate-pulse" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Expand
        </span>
      </div>
      <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1 rounded">
        {formatSize(attachment.size_bytes)}
      </span>
    </button>
  );
}

export default function MediaSection({ captureId, attachments, normalizedText }: MediaSectionProps) {
  const [expandedImage, setExpandedImage] = useState<{ url: string; filename: string } | null>(null);

  const links = normalizedText ? extractLinks(normalizedText) : [];
  const images = attachments.filter((a) => a.content_type.startsWith("image/"));
  const documents = attachments.filter((a) => !a.content_type.startsWith("image/"));

  if (images.length === 0 && documents.length === 0 && links.length === 0) return null;

  return (
    <div className="mt-4 mb-4">
      <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Image className="w-3.5 h-3.5" />
        Media & Links
      </h4>

      <div className="space-y-3">
        {/* Images */}
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img) => (
              <ImageThumbnail
                key={img.id}
                captureId={captureId}
                attachment={img}
                onExpand={(url) => setExpandedImage({ url, filename: img.filename })}
              />
            ))}
          </div>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {documents.map((doc) => {
              const isPdf = doc.content_type.includes("pdf");
              return (
                <button
                  key={doc.id}
                  onClick={async () => {
                    const apiKey = getApiKey();
                    const url = attachmentUrl(captureId, doc.id);
                    const headers: Record<string, string> = {};
                    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
                    const res = await fetch(url, { headers });
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = doc.filename;
                    a.click();
                    URL.revokeObjectURL(blobUrl);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-violet-500 transition-colors group cursor-pointer text-left"
                >
                  {isPdf ? (
                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">
                    {doc.filename}
                  </span>
                  <span className="text-xs text-zinc-400">{formatSize(doc.size_bytes)}</span>
                  <Download className="w-3.5 h-3.5 text-zinc-400 group-hover:text-violet-500 transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Links */}
        {links.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 no-underline hover:border-violet-500 transition-colors group"
              >
                <Link2 className="w-4 h-4 text-violet-500 shrink-0" />
                <span className="flex-1 text-sm text-violet-600 dark:text-violet-400 truncate">
                  {link}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-violet-500 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setExpandedImage(null)}
        >
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors border-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={expandedImage.url}
              alt={expandedImage.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <span className="text-sm text-zinc-300">{expandedImage.filename}</span>
          </div>
        </div>
      )}
    </div>
  );
}
