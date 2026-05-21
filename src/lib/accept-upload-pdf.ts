/**
 * iOS Safari / „Dateien“ often report PDFs as `application/octet-stream`, empty type,
 * or omit the `.pdf` extension — we accept likely picks and rely on `%PDF` magic validation.
 */
export function looksLikeUploadedPdf(file: File): boolean {
  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".pdf")) return true;

  const type = file.type.trim().toLowerCase();
  if (!type) return true;

  return (
    type === "application/pdf" ||
    type === "application/x-pdf" ||
    type === "application/octet-stream"
  );
}
