import type { ScanActivityEvent } from "@skincause/contracts";

export function scanActivity(
  source: ScanActivityEvent["source"],
  message: string,
  level: ScanActivityEvent["level"] = "info"
): ScanActivityEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    source,
    level,
    message
  };
}
