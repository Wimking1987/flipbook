import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { blobStorageEnabled, savePdfBytes } from "@/lib/pdf-storage";
import { looksLikeUploadedPdf } from "@/lib/accept-upload-pdf";
import { validatePdfBuffer } from "@/lib/validate-pdf";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

function idFromRequest(): string {
  for (let i = 0; i < 8; i++) {
    const id = nanoid(16);
    if (ID_RE.test(id)) return id;
  }
  return nanoid(16);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (!looksLikeUploadedPdf(file)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const v = validatePdfBuffer(buf);
  if (v === "not_pdf") {
    return NextResponse.json({ error: "not_pdf" }, { status: 400 });
  }
  if (v === "too_large") {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const id = idFromRequest();
  try {
    await savePdfBytes(id, buf);
  } catch (e) {
    console.error(e);
    if (!blobStorageEnabled()) {
      return NextResponse.json(
        {
          error: "storage_failed",
          hint: "Set BLOB_READ_WRITE_TOKEN for production, or ensure .data is writable for local dev.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const viewerUrl = `${origin}/v/${id}`;
  const embedUrl = `${origin}/embed/${id}`;

  return NextResponse.json({
    id,
    viewerUrl,
    embedUrl,
    pdfUrl: `${origin}/api/pdf/${id}`,
    storage: blobStorageEnabled() ? "vercel_blob" : "local",
  });
}
