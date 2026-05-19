"use client";

import { useState } from "react";

type Props = {
  viewerUrl: string;
  embedUrl: string;
};

export function EmbedCodeBlock({ viewerUrl, embedUrl }: Props) {
  /** Randlos: iframe füllt die Höhe des eingebetteten Bereichs (Wix: Sektion Höhe = z. B. 100vh). */
  const iframeFullscreen = `<iframe
  src="${embedUrl}"
  title="PDF Flipbook"
  loading="lazy"
  allow="fullscreen"
  style="border:0;margin:0;padding:0;width:100%;height:100vh;max-width:100%;display:block;background:transparent;vertical-align:top;"
></iframe>`;

  const iframeFixed = `<iframe
  src="${embedUrl}"
  title="PDF Flipbook"
  loading="lazy"
  style="border:0;margin:0;width:100%;max-width:100%;height:640px;display:block;background:transparent;"
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
          iframe — volle Höhe (ohne schwarzen Rand)
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Die Einbettungsseite ist weiß (Hintergrund &quot;neutral&quot;). Kein{" "}
          <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-700">
            border
          </code>
          , Hintergrund transparent. In Wix die HTML-Sektion auf die volle
          Seitenhöhe ziehen oder ein festes Minimum (z. B. 800px) wählen.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <pre className="max-h-48 max-w-full flex-1 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
            {iframeFullscreen}
          </pre>
          <button
            type="button"
            onClick={() => void copy(iframeFullscreen, "iframeFs")}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {copied === "iframeFs" ? "Kopiert" : "HTML kopieren"}
          </button>
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          iframe — fixe Höhe (640px)
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <pre className="max-h-40 max-w-full flex-1 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
            {iframeFixed}
          </pre>
          <button
            type="button"
            onClick={() => void copy(iframeFixed, "iframeFix")}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {copied === "iframeFix" ? "Kopiert" : "HTML kopieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
