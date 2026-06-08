import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_PDF_BYTES } from "@/lib/constants";
import {
  uploadErrorMessage,
  validateUploadPathname,
} from "@/lib/upload-shared";

export const maxDuration = 60;

/** Generous per-page image cap; pages are downscaled JPEGs. */
const MAX_PAGE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const allowed = validateUploadPathname(pathname);
        if (!allowed) {
          throw new Error("invalid_pathname");
        }
        const maximumSizeInBytes =
          allowed.kind === "pdf"
            ? MAX_PDF_BYTES
            : allowed.kind === "page"
              ? MAX_PAGE_IMAGE_BYTES
              : MAX_MANIFEST_BYTES;
        return {
          allowedContentTypes: allowed.contentTypes,
          maximumSizeInBytes,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ id: allowed.id, kind: allowed.kind }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload_failed";
    return NextResponse.json(
      {
        error: message === "invalid_pathname" ? "invalid_pathname" : "upload_failed",
        hint: uploadErrorMessage(message),
      },
      { status: 400 },
    );
  }
}
