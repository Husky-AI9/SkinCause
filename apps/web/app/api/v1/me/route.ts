import { serverServices, success } from "@skincause/server-core";

export async function GET() {
  return Response.json(success(serverServices.getProfile()));
}
