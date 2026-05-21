"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  FlipbookViewer,
  type FlipBackground,
} from "@/components/FlipbookViewer";
import { EmbedCodeBlock } from "@/components/EmbedCodeBlock";
import { looksLikeUploadedPdf } from "@/lib/accept-upload-pdf";
import { MAX_PDF_BYTES } from "@/lib/constants";
import {
  buildUploadResult,
  generateUploadId,
  readUploadJson,
  uploadErrorMessage,
  uploadBlobPathname,
  type UploadResult,
} from "@/lib/upload-shared";
import { isPdfMagic } from "@/lib/validate-pdf";

const BACKGROUNDS: { id: FlipBackground; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "wood", label: "Holz" },
  { id: "dark", label: "Dunkel" },
];

type Props = {
  /** Production on Vercel: direct browser → Blob upload (bypasses 4.5 MB serverless body limit). */
  useClientUpload?: boolean;
};

async function validatePdfFile(file: File): Promise<string | null> {
  if (!looksLikeUploadedPdf(file)) return "invalid_type";
  if (file.size > MAX_PDF_BYTES) return "too_large";
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!isPdfMagic(head)) return "not_pdf";
  return null;
}

function pickPdfFromDrop(dataTransfer: DataTransfer): File | null {
  const files = dataTransfer.files;
  if (!files?.length) return null;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file && looksLikeUploadedPdf(file)) return file;
  }
  return files[0] ?? null;
}

export function HomeClient({ useClientUpload = false }: Props) {
  const [background, setBackground] = useState<FlipBackground>("neutral");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const dragDepthRef = useRef(0);

  const onFile = useCallback(
    async (file: File | null) => {
      setError(null);
      setResult(null);
      if (!file) return;

      const validationError = await validatePdfFile(file);
      if (validationError) {
        setError(uploadErrorMessage(validationError));
        return;
      }

      const localUrl = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });

      setUploading(true);
      try {
        if (useClientUpload) {
          const id = generateUploadId();
          await upload(uploadBlobPathname(id), file, {
            access: "public",
            handleUploadUrl: "/api/upload/client",
            contentType: file.type || "application/pdf",
            multipart: file.size > 4 * 1024 * 1024,
          });
          setResult(
            buildUploadResult(id, window.location.origin, "vercel_blob"),
          );
          return;
        }

        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const { data, ok } = await readUploadJson<
          UploadResult & { error?: string; hint?: string }
        >(res);
        if (!ok) {
          setError(
            uploadErrorMessage(data.error ?? "upload_failed", data.hint),
          );
          return;
        }
        setResult(data);
      } catch (e) {
        console.error(e);
        setError(uploadErrorMessage("network"));
      } finally {
        setUploading(false);
      }
    },
    [useClientUpload],
  );

  const onDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    if (![...e.dataTransfer.types].includes("Files")) return;
    dragDepthRef.current += 1;
    setDragOver(true);
  }, [uploading]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    e.dataTransfer.dropEffect = "copy";
  }, [uploading]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setDragOver(false);
      if (uploading) return;
      void onFile(pickPdfFromDrop(e.dataTransfer));
    },
    [onFile, uploading],
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
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition ${
            dragOver
              ? "border-amber-500 bg-amber-50/80 dark:border-amber-400 dark:bg-amber-950/40"
              : "border-zinc-300 bg-white hover:border-amber-500/60 hover:bg-amber-50/30 dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:border-amber-400/40 dark:hover:bg-amber-950/20"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept=".pdf,application/pdf,application/x-pdf,application/octet-stream"
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
