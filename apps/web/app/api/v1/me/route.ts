import { failure, serverServices, success } from "@skincause/server-core";
import { AuthenticationError, resolveRequestActor } from "../../../../lib/supabase-server";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    if (actor.kind === "guest") return Response.json(success(serverServices.getProfile()));
    return Response.json(success({
      mode: "authenticated",
      userId: actor.userId,
      email: actor.email,
      displayName: actor.displayName,
      minimumSupportedClientVersion: "0.1.0",
      capabilities: ["routine", "persistent-scans", "experiments", "privacy-export"]
    }));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(failure("UNAUTHORIZED", error.message, false), { status: 401 });
    }
    return Response.json(failure("PERSISTENCE_UNAVAILABLE", "Your profile is temporarily unavailable.", true), {
      status: 503
    });
  }
}
