import { writeFile } from "node:fs/promises";

const operation = (summary, requestBody = false) => ({
  summary,
  ...(requestBody
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        }
      }
    : {}),
  responses: {
    "200": {
      description: "Successful response",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccess" } } }
    },
    "400": {
      description: "Validated API error",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiFailure" } } }
    }
  }
});

const document = {
  openapi: "3.1.0",
  info: {
    title: "SkinCause API",
    version: "1.0.0",
    description: "Portable JSON contract for SkinCause web and native clients."
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/me": { get: operation("Get the current actor and capabilities") },
    "/products": {
      get: operation("List routine products"),
      post: operation("Create a routine product", true)
    },
    "/products/{id}": { patch: operation("Update product metadata or routine history", true) },
    "/experiments": {
      get: operation("List investigations"),
      post: operation("Create a one-change investigation", true)
    },
    "/experiments/{id}": { get: operation("Get an investigation timeline") },
    "/experiments/{id}/check-ins": { post: operation("Create a structured check-in", true) },
    "/experiments/{id}/complete": { post: operation("Freeze the deterministic result", true) },
    "/experiments/{id}/export": { get: operation("Export an investigation summary") },
    "/scans/upload-sessions": { post: operation("Create a resumable upload session", true) },
    "/scans/{id}/submit": { post: operation("Submit or resume provider analysis", true) },
    "/scans/{id}": { get: operation("Get resumable scan status") },
    "/scans/{id}/image": { delete: operation("Delete an original image") },
    "/account": { delete: operation("Delete all owner data") }
  },
  components: {
    schemas: {
      ApiSuccess: {
        type: "object",
        required: ["data"],
        properties: {
          data: {},
          meta: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              apiVersion: { const: "v1" }
            }
          }
        }
      },
      ApiFailure: {
        type: "object",
        required: ["error", "meta"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "retryable"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              retryable: { type: "boolean" }
            }
          },
          meta: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              apiVersion: { const: "v1" }
            }
          }
        }
      }
    }
  }
};

await writeFile("docs/openapi.json", `${JSON.stringify(document, null, 2)}\n`);
