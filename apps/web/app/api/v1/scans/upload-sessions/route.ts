import { failure, serverServices, success } from "@skincause/server-core";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    clientRequestId?: string;
    mimeType?: string;
    byteSize?: number;
  };
  if (!body.clientRequestId || !["image/jpeg", "image/png"].includes(body.mimeType ?? "")) {
    return Response.json(failure("UNSUPPORTED_FORMAT", "Upload a JPG or PNG image.", true), { status: 400 });
  }
  if ((body.byteSize ?? 0) >= 10_000_000) {
    return Response.json(failure("IMAGE_TOO_LARGE", "Choose an image smaller than 10 MB.", true), { status: 400 });
  }
  const session = serverServices.createUploadSession(body.clientRequestId);
  return Response.json(success({
    scanId: session.scanId,
    uploadUrl: `/api/v1/scans/${session.scanId}/upload`,
    method: "PUT",
    requiredHeaders: { "content-type": body.mimeType },
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
  }), { status: 201 });
}
