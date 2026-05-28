import { nanoid } from "nanoid";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

export function generateUploadId(): string {
  for (let i = 0; i < 8; i++) {
    const id = nanoid(16);
    if (ID_RE.test(id)) return id;
  }
  return nanoid(16);
}

const BLOB_PREFIX = "flipbook";

export function uploadBlobPathname(id: string): string {
  return `${BLOB_PREFIX}/${id}.pdf`;
}

/** Pre-rendered page image, 1-based, zero-padded for stable ordering. */
export function pageImageBlobPathname(id: string, page: number): string {
  return `${BLOB_PREFIX}/${id}/p${String(page).padStart(4, "0")}.jpg`;
}

export function manifestBlobPathname(id: string): string {
  return `${BLOB_PREFIX}/${id}/manifest.json`;
}

type UploadKind = "pdf" | "page" | "manifest";

type AllowedUpload = {
  id: string;
  kind: UploadKind;
  contentTypes: string[];
};

/**
 * Validates a client-upload pathname and returns the id + allowed content types.
 * Accepts the PDF, pre-rendered page images and the manifest for a given id.
 */
export function validateUploadPathname(pathname: string): AllowedUpload | null {
  const id = "([a-zA-Z0-9_-]{12,24})";
  const pdf = new RegExp(`^${BLOB_PREFIX}/${id}\\.pdf$`).exec(pathname);
  if (pdf) {
    return {
      id: pdf[1],
      kind: "pdf",
      contentTypes: [
        "application/pdf",
        "application/x-pdf",
        "application/octet-stream",
      ],
    };
  }
  const page = new RegExp(`^${BLOB_PREFIX}/${id}/p\\d{4}\\.jpg$`).exec(pathname);
  if (page) {
    return { id: page[1], kind: "page", contentTypes: ["image/jpeg"] };
  }
  const manifest = new RegExp(`^${BLOB_PREFIX}/${id}/manifest\\.json$`).exec(
    pathname,
  );
  if (manifest) {
    return {
      id: manifest[1],
      kind: "manifest",
      contentTypes: ["application/json"],
    };
  }
  return null;
}

export function uploadIdFromPathname(pathname: string): string | null {
  return validateUploadPathname(pathname)?.id ?? null;
}

export const FLIP_MANIFEST_VERSION = 1;

export type FlipManifest = {
  v: number;
  pages: number;
  /** Aspect-defining dimensions of page 1 (px). */
  width: number;
  height: number;
  /** Public image URLs, one per page, in order. */
  images: string[];
};

export function buildUploadResult(
  id: string,
  origin: string,
  storage: "vercel_blob" | "local",
) {
  return {
    id,
    viewerUrl: `${origin}/v/${id}`,
    embedUrl: `${origin}/embed/${id}`,
    pdfUrl: `${origin}/api/pdf/${id}`,
    storage,
  };
}

export type UploadResult = ReturnType<typeof buildUploadResult>;

export function uploadErrorMessage(
  code: string,
  hint?: string,
): string {
  switch (code) {
    case "too_large":
      return "Datei ist zu groß (max. 20 MB).";
    case "too_large_server":
      return "Datei ist zu groß für den Server-Upload (max. 4,5 MB auf Vercel). Bitte Seite neu laden — Client-Upload sollte aktiv sein.";
    case "not_pdf":
      return "Keine gültige PDF-Datei.";
    case "invalid_type":
      return "Bitte eine PDF-Datei wählen.";
    case "missing_file":
      return "Keine Datei übermittelt.";
    case "invalid_pathname":
      return "Upload-Pfad ungültig.";
    case "storage_failed":
      return hint
        ? `Speichern fehlgeschlagen: ${hint}`
        : "Speichern fehlgeschlagen. Auf Vercel: Storage → Blob verbinden, `BLOB_READ_WRITE_TOKEN` setzen, Redeploy (siehe README).";
    case "server_unavailable":
      return "Server vorübergehend nicht erreichbar. Bitte in ein paar Sekunden erneut versuchen.";
    case "invalid_response":
      return "Unerwartete Server-Antwort beim Upload.";
    case "network":
      return "Netzwerkfehler beim Upload. Verbindung prüfen und erneut versuchen.";
    default:
      return hint ? `${code}: ${hint}` : `Upload fehlgeschlagen (${code}).`;
  }
}

export async function readUploadJson<T extends { error?: string; hint?: string }>(
  res: Response,
): Promise<{ data: T; ok: boolean; status: number }> {
  const text = await res.text();
  if (!text) {
    if (res.status === 413) {
      return {
        data: { error: "too_large_server" } as T,
        ok: false,
        status: res.status,
      };
    }
    if (res.status >= 502) {
      return {
        data: { error: "server_unavailable" } as T,
        ok: false,
        status: res.status,
      };
    }
    return {
      data: { error: "invalid_response" } as T,
      ok: false,
      status: res.status,
    };
  }

  try {
    return { data: JSON.parse(text) as T, ok: res.ok, status: res.status };
  } catch {
    if (res.status === 413) {
      return {
        data: { error: "too_large_server" } as T,
        ok: false,
        status: res.status,
      };
    }
    if (res.status >= 502) {
      return {
        data: { error: "server_unavailable" } as T,
        ok: false,
        status: res.status,
      };
    }
    return {
      data: { error: "invalid_response" } as T,
      ok: false,
      status: res.status,
    };
  }
}
