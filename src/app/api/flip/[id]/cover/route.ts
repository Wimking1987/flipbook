import { NextResponse } from "next/server";
import {
  coverUrlFromManifest,
  getFlipManifest,
  resolveCoverUrl,
} from "@/lib/flip-manifest";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!ID_RE.test(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  const url = await resolveCoverUrl(id);
  if (!url) {
    const manifest = await getFlipManifest(id);
    const fallback = coverUrlFromManifest(manifest);
    if (!fallback) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.redirect(fallback, 302);
  }

  return NextResponse.redirect(url, 302);
}
