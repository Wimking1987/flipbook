import { NextResponse } from "next/server";
import { blobStorageEnabled, savePdfBytes } from "@/lib/pdf-storage";
import { looksLikeUploadedPdf } from "@/lib/accept-upload-pdf";
import {
  buildUploadResult,
  generateUploadId,
  uploadErrorMessage,
  readUploadJson,
} from "@/lib/upload-shared";
import { validatePdfBuffer } from "@/lib/validate-pdf";

export const maxDuration = 60;

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

  const id = generateUploadId();
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
  return NextResponse.json(
    buildUploadResult(id, origin, blobStorageEnabled() ? "vercel_blob" : "local"),
  );
}
