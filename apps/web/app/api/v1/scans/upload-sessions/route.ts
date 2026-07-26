import { failure, serverServices, success } from "@skincause/server-core";
import { createSkinAnalysisProvider } from "../../../../../lib/skin-analysis";
import {
  AuthenticationError,
  createPersistentScanService,
  createSignedScanUpload,
  resolveRequestActor
} from "../../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      clientRequestId?: string;
      mimeType?: string;
      byteSize?: number;
      retainImage?: boolean;
    };
    if (!body.clientRequestId || !["image/jpeg", "image/png"].includes(body.mimeType ?? "")) {
      return Response.json(failure("UNSUPPORTED_FORMAT", "Upload a JPG or PNG image.", true), { status: 400 });
    }
    const byteSize = body.byteSize ?? 0;
    if (!Number.isInteger(byteSize) || byteSize <= 0) {
      return Response.json(failure("EMPTY_IMAGE", "Choose a non-empty image.", true), { status: 400 });
    }
    if (byteSize >= Number(process.env.YOUCAM_MAX_IMAGE_BYTES ?? 10_000_000)) {
      return Response.json(failure("IMAGE_TOO_LARGE", "Choose an image smaller than 10 MB.", true), { status: 400 });
    }

    const mimeType = body.mimeType as "image/jpeg" | "image/png";
    const actor = await resolveRequestActor(request);
    if (actor.kind === "authenticated") {
      const scan = await createPersistentScanService(actor).createUploadSession(
          actor.userId,
          body.clientRequestId,
          {
            mimeType,
            byteSize,
            provider: createSkinAnalysisProvider().providerName,
            retainImage: body.retainImage
          }
        );
      const upload = await createSignedScanUpload(scan);
      return Response.json(success({
        scanId: scan.id,
        upload,
        expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString()
      }), { status: 201 });
    }
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        failure("AUTH_REQUIRED", "Start the demo or sign in before uploading a scan.", false),
        { status: 401 }
      );
    }

    const scanId = serverServices.createUploadSession(body.clientRequestId, {
      mimeType,
      byteSize
    }).scanId;
    return Response.json(success({
      scanId,
      upload: {
        type: "same-origin",
        url: `/api/v1/scans/${scanId}/upload`,
        method: "PUT",
        requiredHeaders: { "content-type": mimeType }
      },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
    }), { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(failure("PERSISTENCE_UNAVAILABLE", "The scan could not be saved. Try again.", true), {
      status: 503
    });
  }
}
