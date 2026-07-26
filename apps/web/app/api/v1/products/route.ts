import { productSchema } from "@skincause/contracts";
import { failure, serverServices, success } from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../lib/route-errors";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../lib/supabase-server";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const products = actor.kind === "authenticated"
      ? await createPersistentWorkspaceService(actor).listProducts(actor.userId)
      : serverServices.listProducts();
    return Response.json(success(products));
  } catch (error) {
    return persistenceErrorResponse(error, "Your routine is temporarily unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    const parsed = productSchema.safeParse({ ...(await request.json()), id: crypto.randomUUID() });
    if (!parsed.success) {
      return Response.json(failure("VALIDATION_FAILED", "Check the product fields and try again.", true), { status: 400 });
    }
    const actor = await resolveRequestActor(request);
    const product = actor.kind === "authenticated"
      ? await createPersistentWorkspaceService(actor).createProduct(actor.userId, parsed.data)
      : serverServices.createProduct(parsed.data);
    return Response.json(success(product), { status: 201 });
  } catch (error) {
    return persistenceErrorResponse(error, "The product could not be saved. Try again.");
  }
}
