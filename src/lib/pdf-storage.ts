import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

const PREFIX = "flipbook";

export function blobPathname(id: string): string {
  return `${PREFIX}/${id}.pdf`;
}

export function localPdfPath(id: string): string {
  return path.join(process.cwd(), ".data", PREFIX, `${id}.pdf`);
}

export function blobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function savePdfBytes(
  id: string,
  bytes: Uint8Array,
): Promise<void> {
  if (blobStorageEnabled()) {
    await put(blobPathname(id), Buffer.from(bytes), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });
    return;
  }
  const filePath = localPdfPath(id);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}
