import { apiSuccessSchema, productSchema } from "@skincause/contracts";
import { products } from "@skincause/domain";
import { describe, expect, it } from "vitest";

describe("portable API contracts", () => {
  it("validates the seeded product contract", () => {
    expect(productSchema.array().parse(products)).toHaveLength(3);
  });

  it("validates the standard response envelope", () => {
    const schema = apiSuccessSchema(productSchema.array());
    expect(schema.parse({ data: products, meta: { requestId: "req_1", apiVersion: "v1" } }).data).toHaveLength(3);
  });
});
