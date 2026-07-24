import { productSchema } from "@skincause/contracts";
import { failure, serverServices, success } from "@skincause/server-core";

export async function GET() {
  return Response.json(success(serverServices.listProducts()));
}

export async function POST(request: Request) {
  const parsed = productSchema.safeParse({ ...(await request.json()), id: crypto.randomUUID() });
  if (!parsed.success) {
    return Response.json(failure("VALIDATION_FAILED", "Check the product fields and try again.", true), { status: 400 });
  }
  return Response.json(success(serverServices.createProduct(parsed.data)), { status: 201 });
}
