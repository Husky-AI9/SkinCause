import { createApiClient } from "@skincause/api-client";
import { describe, expect, it, vi } from "vitest";

describe("api client", () => {
  it("attaches an injected bearer token", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer mobile-token");
      return new Response(JSON.stringify({ data: { mode: "native", capabilities: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const client = createApiClient({
      baseUrl: "https://example.test/api/v1",
      getAccessToken: async () => "mobile-token",
      fetchImpl
    });
    await client.getMe();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
