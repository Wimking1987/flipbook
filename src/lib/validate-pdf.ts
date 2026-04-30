import { MAX_PDF_BYTES } from "./constants";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

export function isPdfMagic(buf: Uint8Array): boolean {
  if (buf.length < 5) return false;
  for (let i = 0; i < 4; i++) {
    if (buf[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

export type PdfValidationError = "not_pdf" | "too_large";

export function validatePdfBuffer(buf: Uint8Array): PdfValidationError | null {
  if (!isPdfMagic(buf)) return "not_pdf";
  if (buf.byteLength > MAX_PDF_BYTES) return "too_large";
  return null;
}
