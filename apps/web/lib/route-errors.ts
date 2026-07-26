import { failure, WorkspaceRuleError } from "@skincause/server-core";
import { AuthenticationError } from "./supabase-server";

export function persistenceErrorResponse(error: unknown, message: string) {
  if (error instanceof AuthenticationError) {
    return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
  }
  if (error instanceof WorkspaceRuleError) {
    return Response.json(failure(error.code, error.message, false), { status: error.status });
  }
  return Response.json(failure("PERSISTENCE_UNAVAILABLE", message, true), { status: 503 });
}
