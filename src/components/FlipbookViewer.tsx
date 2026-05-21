"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageFlip } from "page-flip/dist/js/page-flip.browser.js";
import {
  iosLikeDevice,
  loadPdfDocument,
  renderPdfPageToUrl,
  renderProfile,
  viewerErrorMessage,
  type RenderProfile,
} from "@/lib/pdf-viewer-render";
import "page-flip/src/Style/stPageFlip.css";

export type FlipBackground = "wood" | "neutral" | "dark";

const SURFACE: Record<FlipBackground, string> = {
  neutral: "flip-surface flip-surface-neutral",
  wood: "flip-surface flip-surface-wood",
  dark: "flip-surface flip-surface-dark",
};

const SPREAD_MIN_WIDTH = 560;

/** Safari auf iPad/iPhone: eingebetteter PDF-Viewer (JPEG2000/Druck-PDFs). */
function MobileNativePdfViewer({ pdfUrl }: { pdfUrl: string }) {
  return (
    <iframe
      src={pdfUrl}
      title="PDF"
      className="min-h-[min(72dvh,780px)] w-full flex-1 border-0 bg-white"
    />
  );
}

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
  const isMobile = iosLikeDevice();

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
    if (!pdfUrl || !isMobile) return;
    setStatus("ready");
    setMessage("");
  }, [pdfUrl, isMobile]);

  useEffect(() => {
    if (!pdfUrl || isMobile) return;

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

    const measure = () => ({
      w: Math.max(60, host?.clientWidth || 400),
      h: Math.max(60, host?.clientHeight || 400),
    });

    const buildFlip = async (
      PageFlipCtor: typeof import("page-flip/dist/js/page-flip.browser.js").PageFlip,
      urls: string[],
      iw: number,
      ih: number,
      profile: RenderProfile,
    ) => {
      if (cancelled || !urls.length || !hostRef.current) return;

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      const { w: cw, h: ch } = measure();
      const useSpread = cw >= SPREAD_MIN_WIDTH;
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
        maxShadowOpacity: 0.72,
        showCover: true,
        drawShadow: true,
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

      pf.on("flip", scheduleSync);
      pf.on("changeOrientation", scheduleSync);
      pf.on("init", scheduleSync);
      scheduleSync();
      scheduleSync();

      pageFlipRef.current = pf;
      setStatus("ready");
      setMessage("");
    };

    void (async () => {
      const profile = renderProfile();
      try {
        const pdfjs = await import("pdfjs-dist");
        const doc = await loadPdfDocument(pdfjs, pdfUrl, profile);
        if (cancelled) return;

        const numPages = Math.min(doc.numPages, profile.maxPages);

        const { PageFlip: PageFlipCtor } = await import(
          "page-flip/dist/js/page-flip.browser.js"
        );

        const page1 = await doc.getPage(1);
        const base1 = page1.getViewport({ scale: 1 });
        const scale1 = Math.min(
          profile.maxScale,
          profile.maxRasterWidth / Math.max(base1.width, 1),
        );
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

        if (cancelled || urls.length === 0) return;

        urlsRef.current = urls;
        if (!ensureMount()) return;
        await buildFlip(PageFlipCtor, urls, iw, ih, profile);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setStatus("error");
          setMessage(viewerErrorMessage(e));
        }
      }
    })();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro =
      host &&
      !isMobile
        ? new ResizeObserver(() => {
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
          })
        : null;
    if (host && ro) ro.observe(host);

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      ro?.disconnect();
      tearDown();
    };
  }, [pdfUrl, tearDown, isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== "ready" || !pageFlipRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        pageFlipRef.current.flipNext(e.shiftKey ? "bottom" : "top");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        pageFlipRef.current.flipPrev(e.shiftKey ? "bottom" : "top");
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
        <div className={SURFACE[background]} key={background} aria-hidden />
        {isMobile && status === "ready" ? (
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
            <MobileNativePdfViewer pdfUrl={pdfUrl} />
          </div>
        ) : (
          <div
            ref={hostRef}
            className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center ${embed ? "p-0" : "p-2 sm:p-4"}`}
          />
        )}
      </div>
      {status === "ready" && !embed && !isMobile && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          Tastatur: ← → zum Blättern · erste PDF-Seite = Cover, danach
          Doppelseiten
        </p>
      )}
      {status === "ready" && !embed && isMobile && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          In der PDF scrollen oder mit zwei Fingern zoomen
        </p>
      )}
    </div>
  );
}
