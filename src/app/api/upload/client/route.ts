import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_PDF_BYTES } from "@/lib/constants";
import {
  uploadErrorMessage,
  uploadIdFromPathname,
} from "@/lib/upload-shared";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const id = uploadIdFromPathname(pathname);
        if (!id) {
          throw new Error("invalid_pathname");
        }
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/x-pdf",
            "application/octet-stream",
          ],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ id }),
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
