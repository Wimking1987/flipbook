import { MAX_PDF_PAGES } from "./constants";

const MAX_RASTER_WIDTH = 2000;
const JPEG_QUALITY = 0.92;

export type RenderProfile = {
  ios: boolean;
  maxRasterWidth: number;
  maxScale: number;
  maxPages: number;
  jpegQuality: number;
  maxCanvasSide: number;
  maxCanvasPixels: number;
  maxImageSize: number;
};

export function iosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

export function renderProfile(): RenderProfile {
  if (iosLikeDevice()) {
    return {
      ios: true,
      maxRasterWidth: 1024,
      maxScale: 1.75,
      maxPages: MAX_PDF_PAGES,
      jpegQuality: 0.8,
      maxCanvasSide: 2048,
      maxCanvasPixels: 2_500_000,
      /** Kein Cap — sonst bleiben eingebettete Bilder in Druck-PDFs leer/fehlerhaft. */
      maxImageSize: -1,
    };
  }
  return {
    ios: false,
    maxRasterWidth: MAX_RASTER_WIDTH,
    maxScale: 2.75,
    maxPages: MAX_PDF_PAGES,
    jpegQuality: JPEG_QUALITY,
    maxCanvasSide: 8192,
    maxCanvasPixels: 16_777_216,
    maxImageSize: -1,
  };
}

export function pdfJsPublicRoot(): string {
  if (typeof window === "undefined") return "/pdfjs/";
  return `${window.location.origin}/pdfjs/`;
}

export function computeSafeScale(
  baseWidth: number,
  baseHeight: number,
  profile: RenderProfile,
): number {
  let scale = Math.min(
    profile.maxScale,
    profile.maxRasterWidth / Math.max(baseWidth, 1),
  );
  if (!profile.ios) return scale;

  for (let attempt = 0; attempt < 10; attempt++) {
    const w = Math.floor(baseWidth * scale);
    const h = Math.floor(baseHeight * scale);
    if (
      w >= 1 &&
      h >= 1 &&
      w <= profile.maxCanvasSide &&
      h <= profile.maxCanvasSide &&
      w * h <= profile.maxCanvasPixels
    ) {
      return scale;
    }
    scale *= 0.72;
  }
  return Math.max(0.25, scale);
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

async function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
  if (blob) return URL.createObjectURL(blob);
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    throw new Error("canvas_export_failed");
  }
}

export async function renderPdfPageToUrl(
  page: import("pdfjs-dist").PDFPageProxy,
  profile: RenderProfile,
): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  let scale = computeSafeScale(base.width, base.height, profile);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no_canvas");

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const url = await canvasToObjectUrl(canvas, profile.jpegQuality);
      releaseCanvas(canvas);
      return url;
    } catch (err) {
      lastError = err;
      releaseCanvas(canvas);
      scale *= 0.72;
      if (scale < 0.15) break;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("page_render_failed");
}

export async function loadPdfDocument(
  pdfjs: typeof import("pdfjs-dist"),
  pdfUrl: string,
  profile: RenderProfile,
): Promise<import("pdfjs-dist").PDFDocumentProxy> {
  const pdfRoot = pdfJsPublicRoot();
  pdfjs.GlobalWorkerOptions.workerSrc = `${pdfRoot}pdf.worker.min.mjs`;

  const docInitBase = {
    wasmUrl: `${pdfRoot}wasm/`,
    standardFontDataUrl: `${pdfRoot}standard_fonts/`,
    cMapUrl: `${pdfRoot}cmaps/`,
    cMapPacked: true,
    iccUrl: `${pdfRoot}iccs/`,
    /**
     * iOS/iPadOS: JS-Fallback-Decoder (openjpeg_nowasm_fallback.js) ist oft
     * zuverlässiger als WASM im Worker; relevant für kleine Druck-PDFs mit JPX.
     */
    useWasm: !profile.ios,
    isImageDecoderSupported: false,
    maxImageSize: profile.maxImageSize,
  };

  /**
   * blob:/data: URLs im Worker sind auf iPad oft blockiert — PDF im Hauptthread
   * laden und als `data` übergeben (124 KB ist dafür unkritisch).
   */
  const mustLoadInMainThread =
    profile.ios ||
    pdfUrl.startsWith("blob:") ||
    pdfUrl.startsWith("data:");

  if (!mustLoadInMainThread) {
    const loadingTask = pdfjs.getDocument({
      url: pdfUrl,
      disableRange: false,
      disableStream: false,
      ...docInitBase,
    });
    return loadingTask.promise;
  }

  const pdfResponse = await fetch(
    pdfUrl,
    pdfUrl.startsWith("blob:") ? {} : { cache: "no-store" },
  );
  if (!pdfResponse.ok) {
    throw new Error("pdf_fetch_failed");
  }
  const pdfData = await pdfResponse.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: pdfData,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    ...docInitBase,
  });
  return loadingTask.promise;
}

export function viewerErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "pdf_render_failed";
  if (code === "pdf_fetch_failed") {
    return "PDF konnte nicht geladen werden.";
  }
  if (code === "canvas_export_failed" || code === "no_canvas") {
    return "PDF konnte auf diesem Gerät nicht dargestellt werden (Browser-Limit).";
  }
  return "PDF konnte nicht angezeigt werden.";
}
