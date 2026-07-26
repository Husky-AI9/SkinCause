import { productUpdateSchema } from "@skincause/contracts";
import { failure, serverServices, success } from "@skincause/server-core";
import { persistenceErrorResponse } from "../../../../../lib/route-errors";
import {
  createPersistentWorkspaceService,
  resolveRequestActor
} from "../../../../../lib/supabase-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const parsed = productUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(failure("VALIDATION_FAILED", "Check the product fields and try again.", true), {
        status: 400
      });
    }
    const actor = await resolveRequestActor(request);
    if (actor.kind === "authenticated") {
      const product = await createPersistentWorkspaceService(actor).updateProduct(
        actor.userId,
        id,
        parsed.data
      );
      return Response.json(success({ ...product, historyAppended: true }));
    }
    const product = serverServices.listProducts().find((item) => item.id === id);
    if (!product) {
      return Response.json(failure("PRODUCT_NOT_FOUND", "The product was not found.", false), { status: 404 });
    }
    return Response.json(success({ ...product, ...parsed.data, id, historyAppended: true }));
  } catch (error) {
    return persistenceErrorResponse(error, "The product could not be updated. Try again.");
  }
}
