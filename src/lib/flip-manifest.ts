import { readFile } from "fs/promises";
import path from "path";
import { head } from "@vercel/blob";
import { blobStorageEnabled } from "@/lib/pdf-storage";
import {
  coverBlobPathname,
  manifestBlobPathname,
  type FlipManifest,
} from "@/lib/upload-shared";

function localManifestPath(id: string): string {
  return path.join(process.cwd(), ".data", "flipbook", id, "manifest.json");
}

export async function getFlipManifest(
  id: string,
): Promise<FlipManifest | null> {
  if (blobStorageEnabled()) {
    try {
      const meta = await head(manifestBlobPathname(id));
      const upstream = await fetch(meta.url, { cache: "no-store" });
      if (!upstream.ok) return null;
      return (await upstream.json()) as FlipManifest;
    } catch {
      return null;
    }
  }

  try {
    const buf = await readFile(localManifestPath(id));
    return JSON.parse(buf.toString()) as FlipManifest;
  } catch {
    return null;
  }
}

export function coverUrlFromManifest(
  manifest: FlipManifest | null,
): string | null {
  if (!manifest) return null;
  return manifest.cover ?? manifest.images?.[0] ?? null;
}

/** Resolve the public cover image URL (small preview JPEG). */
export async function resolveCoverUrl(id: string): Promise<string | null> {
  if (blobStorageEnabled()) {
    try {
      const meta = await head(coverBlobPathname(id));
      return meta.url;
    } catch {
      /* fall through to manifest */
    }
  }

  const manifest = await getFlipManifest(id);
  return coverUrlFromManifest(manifest);
}
