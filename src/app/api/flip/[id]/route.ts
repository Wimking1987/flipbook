import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { blobStorageEnabled } from "@/lib/pdf-storage";
import { manifestBlobPathname } from "@/lib/upload-shared";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

function localManifestPath(id: string): string {
  return path.join(process.cwd(), ".data", "flipbook", id, "manifest.json");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!ID_RE.test(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  if (blobStorageEnabled()) {
    try {
      const meta = await head(manifestBlobPathname(id));
      const upstream = await fetch(meta.url, { cache: "no-store" });
      if (!upstream.ok) {
        return new NextResponse("Not found", { status: 404 });
      }
      const json = await upstream.text();
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  try {
    const buf = await readFile(localManifestPath(id));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
