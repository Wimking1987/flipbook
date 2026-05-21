"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageFlip } from "page-flip/dist/js/page-flip.browser.js";
import { MAX_PDF_PAGES } from "@/lib/constants";
import "page-flip/src/Style/stPageFlip.css";

export type FlipBackground = "wood" | "neutral" | "dark";

/** Volle Klassennamen — damit Styles sicher greifen (kein dynamisches Tailwind-Purging). */
const SURFACE: Record<FlipBackground, string> = {
  neutral: "flip-surface flip-surface-neutral",
  wood: "flip-surface flip-surface-wood",
  dark: "flip-surface flip-surface-dark",
};

const MAX_RASTER_WIDTH = 2000;
const JPEG_QUALITY = 0.92;
const SPREAD_MIN_WIDTH = 560;

type RenderProfile = {
  ios: boolean;
  maxRasterWidth: number;
  maxScale: number;
  maxPages: number;
  jpegQuality: number;
  maxCanvasSide: number;
  maxCanvasPixels: number;
  maxImageSize: number;
  /** pdf.js lädt die URL selbst — spart auf iOS den doppelten ArrayBuffer. */
  useDirectUrlLoading: boolean;
};

/** iPhone / iPad / „Desktop Safari auf iPadOS“ — dort sind Canvas-/GPU-Limits und Worker-Pfade oft knapper. */
function iosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

function renderProfile(): RenderProfile {
  if (iosLikeDevice()) {
    return {
      ios: true,
      maxRasterWidth: 1200,
      maxScale: 2,
      maxPages: 80,
      jpegQuality: 0.82,
      maxCanvasSide: 2048,
      maxCanvasPixels: 4_000_000,
      maxImageSize: 16_777_216,
      useDirectUrlLoading: true,
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
    useDirectUrlLoading: false,
  };
}

function computeSafeScale(
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

function pdfJsPublicRoot(): string {
  if (typeof window === "undefined") return "/pdfjs/";
  return `${window.location.origin}/pdfjs/`;
}

/**
 * Eine PDF-Seite (Pixel iw×ih) in cw×ch einpassen.
 * Doppelseite = Platz für 2× Seitenbreite (Cover nutzt dieselbe Fläche, eine Seite leer).
 */
function fitPageDimensionsPixels(
  iw: number,
  ih: number,
  cw: number,
  ch: number,
  useSpread: boolean,
): { pageW: number; pageH: number } {
  const iwN = Math.max(1, iw);
  const ihN = Math.max(1, ih);
  const pad = 16;
  const aw = Math.max(40, cw - pad * 2);
  const ah = Math.max(40, ch - pad * 2);
  let s: number;
  if (useSpread) {
    s = Math.min(aw / (2 * iwN), ah / ihN);
  } else {
    s = Math.min(aw / iwN, ah / ihN);
  }
  if (!Number.isFinite(s) || s <= 0) s = 1;
  let pageW = Math.floor(iwN * s);
  let pageH = Math.floor((pageW * ihN) / iwN);
  pageW = Math.max(32, pageW);
  pageH = Math.max(32, pageH);
  return { pageW, pageH };
}

function buildPageElements(urls: string[]): HTMLElement[] {
  return urls.map((href) => {
    const wrap = document.createElement("div");
    wrap.dataset.density = "soft";
    const img = document.createElement("img");
    img.src = href;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.className = "flip-page-img";
    wrap.appendChild(img);
    return wrap;
  });
}

async function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  quality = JPEG_QUALITY,
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

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

async function renderPdfPageToUrl(
  page: import("pdfjs-dist").PDFPageProxy,
  profile: RenderProfile,
): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  let scale = computeSafeScale(base.width, base.height, profile);

  for (let attempt = 0; attempt < 5; attempt++) {
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
    } catch {
      releaseCanvas(canvas);
      scale *= 0.72;
      if (scale < 0.2) throw new Error("page_render_failed");
    }
  }

  throw new Error("page_render_failed");
}

function syncBookDomSize(mount: HTMLElement, pf: PageFlip) {
  try {
    const r = pf.getBoundsRect();
    mount.style.boxSizing = "border-box";
    mount.style.flexShrink = "0";
    mount.style.width = `${Math.ceil(r.width)}px`;
    mount.style.height = `${Math.ceil(r.height)}px`;
    mount.style.maxWidth = "100%";
  } catch {
    /* ignore */
  }
}

function detachFlipListeners(pf: PageFlip | null) {
  if (!pf) return;
  try {
    pf.off("flip");
    pf.off("changeOrientation");
    pf.off("init");
  } catch {
    /* ignore */
  }
}

async function decodePageImages(pages: HTMLElement[]): Promise<void> {
  for (const p of pages) {
    const img = p.querySelector("img");
    if (!img) continue;
    if (!img.complete) {
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }
    try {
      await img.decode();
    } catch {
      /* ignore */
    }
  }
}

type Props = {
  pdfUrl: string;
  background?: FlipBackground;
  className?: string;
  embed?: boolean;
};

export function FlipbookViewer({
  pdfUrl,
  background = "neutral",
  className = "",
  embed = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const urlsRef = useRef<string[]>([]);
  const dimsRef = useRef<{ iw: number; ih: number }>({ iw: 400, ih: 400 });
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("");

  const tearDown = useCallback(() => {
    detachFlipListeners(pageFlipRef.current);
    try {
      pageFlipRef.current?.destroy();
    } catch {
      /* ignore */
    }
    pageFlipRef.current = null;
    mountRef.current = null;
    if (hostRef.current) hostRef.current.innerHTML = "";
    for (const url of urlsRef.current) {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
    urlsRef.current = [];
  }, []);

  useEffect(() => {
    if (!pdfUrl || !hostRef.current) return;

    tearDown();
    setStatus("loading");
    setMessage("PDF wird geladen …");

    const host = hostRef.current;
    let cancelled = false;

    const ensureMount = (): HTMLDivElement | null => {
      if (!hostRef.current) return null;
      if (mountRef.current?.isConnected) return mountRef.current;
      const shell = document.createElement("div");
      shell.className =
        "flip-book-mount-shadow flex shrink-0 items-center justify-center";
      const el = document.createElement("div");
      el.className =
        "flipbook-mount flipbook-mount-root relative z-10 mx-auto block shrink-0";
      shell.appendChild(el);
      hostRef.current.appendChild(shell);
      mountRef.current = el;
      return el;
    };

    if (!ensureMount()) return;

    const measure = () => ({
      w: Math.max(60, host.clientWidth || 400),
      h: Math.max(60, host.clientHeight || 400),
    });

    const buildFlip = async (
      PageFlipCtor: typeof import("page-flip/dist/js/page-flip.browser.js").PageFlip,
      urls: string[],
      iw: number,
      ih: number,
      profile: RenderProfile,
    ) => {
      if (cancelled || !urls.length) return;

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      const { w: cw, h: ch } = measure();
      const useSpread =
        !iosLikeDevice() && cw >= SPREAD_MIN_WIDTH;
      const { pageW, pageH } = fitPageDimensionsPixels(iw, ih, cw, ch, useSpread);

      detachFlipListeners(pageFlipRef.current);
      try {
        pageFlipRef.current?.destroy();
      } catch {
        /* ignore */
      }
      pageFlipRef.current = null;
      mountRef.current = null;

      if (cancelled) return;
      const mount = ensureMount();
      if (!mount) return;

      const pages = buildPageElements(urls);
      await decodePageImages(pages).catch(() => undefined);

      const pf = new PageFlipCtor(mount, {
        width: pageW,
        height: pageH,
        size: "fixed",
        autoSize: false,
        minWidth: pageW,
        maxWidth: pageW,
        minHeight: pageH,
        maxHeight: pageH,
        maxShadowOpacity: profile.ios ? 0.45 : 0.72,
        showCover: true,
        drawShadow: !profile.ios,
        mobileScrollSupport: true,
        usePortrait: !useSpread,
        startPage: 0,
        flippingTime: 720,
      });

      pf.loadFromHTML(pages);

      const scheduleSync = () => {
        requestAnimationFrame(() => {
          if (!mountRef.current || pageFlipRef.current !== pf) return;
          try {
            pf.update();
          } catch {
            /* ignore */
          }
          syncBookDomSize(mountRef.current, pf);
        });
      };

      const onLayout = () => scheduleSync();
      pf.on("flip", onLayout);
      pf.on("changeOrientation", onLayout);
      pf.on("init", onLayout);

      scheduleSync();
      scheduleSync();

      pageFlipRef.current = pf;
      setStatus("ready");
      setMessage("");
    };

    void (async () => {
      const profile = renderProfile();
      try {
        const { PageFlip: PageFlipCtor } = await import(
          "page-flip/dist/js/page-flip.browser.js"
        );

        const pdfjs = await import("pdfjs-dist");
        const pdfRoot = pdfJsPublicRoot();
        pdfjs.GlobalWorkerOptions.workerSrc = `${pdfRoot}pdf.worker.min.mjs`;

        const docInitBase = {
          wasmUrl: `${pdfRoot}wasm/`,
          standardFontDataUrl: `${pdfRoot}standard_fonts/`,
          cMapUrl: `${pdfRoot}cmaps/`,
          cMapPacked: true,
          iccUrl: `${pdfRoot}iccs/`,
          useWasm: true,
          isImageDecoderSupported: false,
          maxImageSize: profile.maxImageSize,
        };

        let doc: import("pdfjs-dist").PDFDocumentProxy;
        if (profile.useDirectUrlLoading) {
          const loadingTask = pdfjs.getDocument({
            url: pdfUrl,
            disableRange: true,
            disableStream: true,
            ...docInitBase,
          });
          doc = await loadingTask.promise;
        } else {
          const pdfResponse = await fetch(
            pdfUrl,
            pdfUrl.startsWith("blob:") ? {} : { cache: "no-store" },
          );
          if (!pdfResponse.ok) {
            throw new Error("pdf_fetch_failed");
          }
          const pdfData = await pdfResponse.arrayBuffer();
          if (cancelled) return;
          const loadingTask = pdfjs.getDocument({
            data: pdfData,
            disableAutoFetch: true,
            disableStream: true,
            disableRange: true,
            ...docInitBase,
          });
          doc = await loadingTask.promise;
        }

        if (cancelled) return;

        const numPages = Math.min(doc.numPages, profile.maxPages);
        const page1 = await doc.getPage(1);
        const base1 = page1.getViewport({ scale: 1 });
        const scale1 = computeSafeScale(base1.width, base1.height, profile);
        const vp1 = page1.getViewport({ scale: scale1 });
        const iw = Math.max(1, Math.round(vp1.width));
        const ih = Math.max(1, Math.round(vp1.height));
        dimsRef.current = { iw, ih };

        const urls: string[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await doc.getPage(i);
          const jpegUrl = await renderPdfPageToUrl(page, profile);
          try {
            page.cleanup();
          } catch {
            /* ignore */
          }
          urls.push(jpegUrl);
          setMessage(`Seiten rendern … ${i}/${numPages}`);
          if (cancelled) {
            for (const url of urls) {
              if (url.startsWith("blob:")) URL.revokeObjectURL(url);
            }
            return;
          }
        }

        if (cancelled || urls.length === 0) {
          for (const url of urls) {
            if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          }
          return;
        }

        urlsRef.current = urls;
        await buildFlip(PageFlipCtor, urls, iw, ih, profile);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setStatus("error");
          const code =
            e instanceof Error ? e.message : "pdf_render_failed";
          setMessage(
            code === "page_render_failed" && iosLikeDevice()
              ? "PDF auf diesem Gerät zu gross oder zu speicherintensiv. Auf dem Mac erneut hochladen oder eine kleinere PDF verwenden."
              : "PDF konnte nicht angezeigt werden.",
          );
        }
      }
    })();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (!urlsRef.current.length) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        void (async () => {
          const { PageFlip: PageFlipCtor } = await import(
            "page-flip/dist/js/page-flip.browser.js"
          );
          const { iw, ih } = dimsRef.current;
          await buildFlip(
            PageFlipCtor,
            urlsRef.current,
            iw,
            ih,
            renderProfile(),
          );
        })();
      }, 150);
    });
    ro.observe(host);

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      tearDown();
    };
  }, [pdfUrl, tearDown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== "ready" || !pageFlipRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        pageFlipRef.current.flipNext(
          e.shiftKey ? "bottom" : "top",
        );
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        pageFlipRef.current.flipPrev(
          e.shiftKey ? "bottom" : "top",
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  const stageShell = embed
    ? "flip-viewer-stage relative flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden rounded-none"
    : "flip-viewer-stage relative flex h-[min(85dvh,920px)] w-full flex-col overflow-hidden rounded-lg";

  return (
    <div
      className={`flex flex-col ${embed ? "min-h-0 flex-1 gap-0" : "gap-3"} ${embed ? "" : "rounded-2xl border border-zinc-300/70 bg-transparent p-3 dark:border-zinc-600 dark:bg-transparent"} ${className}`}
    >
      {status === "loading" && (
        <p className="text-center text-sm text-zinc-700 dark:text-zinc-300">
          {message}
        </p>
      )}
      {status === "error" && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
      <div className={stageShell} data-flip-bg={background}>
        <div
          className={SURFACE[background]}
          key={background}
          aria-hidden
        />
        <div
          ref={hostRef}
          className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center ${embed ? "p-0" : "p-2 sm:p-4"}`}
        />
      </div>
      {status === "ready" && !embed && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          Tastatur: ← → zum Blättern · erste PDF-Seite = Cover, danach
          Doppelseiten
        </p>
      )}
    </div>
  );
}
