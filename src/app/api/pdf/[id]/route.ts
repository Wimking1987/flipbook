import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import {
  blobPathname,
  blobStorageEnabled,
  localPdfPath,
} from "@/lib/pdf-storage";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

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
      const meta = await head(blobPathname(id));
      const upstream = await fetch(meta.url);
      if (!upstream.ok || !upstream.body) {
        return new NextResponse("Not found", { status: 404 });
      }
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  try {
    const buf = await readFile(localPdfPath(id));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
