import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const before = await readFile("docs/openapi.json", "utf8").catch(() => "");
const generated = spawnSync(process.execPath, ["scripts/generate-openapi.mjs"], { stdio: "inherit" });
if (generated.status !== 0) process.exit(generated.status ?? 1);
const after = await readFile("docs/openapi.json", "utf8");
if (before !== after) {
  console.error("docs/openapi.json was stale. Regenerate it with npm run openapi:generate.");
  process.exit(1);
}
console.log("OpenAPI document is current.");
