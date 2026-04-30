"use client";

import { useCallback, useState } from "react";
import {
  FlipbookViewer,
  type FlipBackground,
} from "@/components/FlipbookViewer";
import { EmbedCodeBlock } from "@/components/EmbedCodeBlock";

type UploadResult = {
  id: string;
  viewerUrl: string;
  embedUrl: string;
  pdfUrl: string;
  storage: string;
};

const BACKGROUNDS: { id: FlipBackground; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "wood", label: "Holz" },
  { id: "dark", label: "Dunkel" },
];

export function HomeClient() {
  const [background, setBackground] = useState<FlipBackground>("neutral");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const onFile = useCallback(
    async (file: File | null) => {
      setError(null);
      setResult(null);
      if (!file) return;
      if (file.type && file.type !== "application/pdf") {
        setError("Bitte eine PDF-Datei wählen.");
        return;
      }

      const localUrl = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });

      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json()) as UploadResult & { error?: string };
        if (!res.ok) {
          const msg =
            data.error === "too_large"
              ? "Datei ist zu groß (max. 20 MB)."
              : data.error === "not_pdf"
                ? "Keine gültige PDF-Datei."
                : "Upload fehlgeschlagen.";
          setError(msg);
          return;
        }
        setResult({
          id: data.id,
          viewerUrl: data.viewerUrl,
          embedUrl: data.embedUrl,
          pdfUrl: data.pdfUrl,
          storage: data.storage,
        });
      } catch {
        setError("Netzwerkfehler beim Upload.");
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          PDF Flipbook
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          PDF hochladen, durchblättern, dann Link oder iframe für deine Website
          kopieren.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white px-6 py-14 transition hover:border-amber-500/60 hover:bg-amber-50/30 dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:border-amber-400/40 dark:hover:bg-amber-950/20">
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <span className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
            PDF hier ablegen oder klicken
          </span>
          <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Max. 20 MB · bis zu 200 Seiten
          </span>
        </label>

        {uploading && (
          <p className="text-center text-sm text-amber-700 dark:text-amber-300">
            Wird hochgeladen …
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Hintergrund:
          </span>
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBackground(b.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                background === b.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      {previewUrl && (
        <section>
          <h2 className="mb-3 text-center text-lg font-medium text-zinc-800 dark:text-zinc-200">
            Vorschau
          </h2>
          <FlipbookViewer pdfUrl={previewUrl} background={background} />
        </section>
      )}

      {result && (
        <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <h2 className="mb-4 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            Bereit zum Teilen
          </h2>
          <EmbedCodeBlock
            viewerUrl={
              background === "neutral"
                ? result.viewerUrl
                : `${result.viewerUrl}?bg=${background}`
            }
            embedUrl={
              background === "neutral"
                ? result.embedUrl
                : `${result.embedUrl}?bg=${background}`
            }
          />
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
            Speicher:{" "}
            {result.storage === "vercel_blob"
              ? "Vercel Blob"
              : "lokal (.data) — für Produktion Vercel Blob empfohlen"}
          </p>
        </section>
      )}

    </div>
  );
}
