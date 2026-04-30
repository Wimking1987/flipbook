"use client";

import { useState } from "react";

type Props = {
  viewerUrl: string;
  embedUrl: string;
};

export function EmbedCodeBlock({ viewerUrl, embedUrl }: Props) {
  const iframe = `<iframe
  src="${embedUrl}"
  width="100%"
  height="640"
  style="border:0;max-width:100%;min-height:480px;"
  loading="lazy"
  title="PDF Flipbook"
></iframe>`;

  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 text-left">
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Link (volle Ansicht)
        </h3>
        <div className="flex flex-wrap gap-2">
          <code className="max-w-full flex-1 overflow-x-auto rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
            {viewerUrl}
          </code>
          <button
            type="button"
            onClick={() => void copy(viewerUrl, "viewer")}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {copied === "viewer" ? "Kopiert" : "Kopieren"}
          </button>
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          iframe (Wix Studio / HTML)
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Schmale Einbettung ohne Seitenrand — empfohlen für eingebettete
          Bereiche.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <pre className="max-h-40 max-w-full flex-1 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
            {iframe}
          </pre>
          <button
            type="button"
            onClick={() => void copy(iframe, "iframe")}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {copied === "iframe" ? "Kopiert" : "HTML kopieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
