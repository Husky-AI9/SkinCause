"use client";

import { ScanFace } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "./app-provider";

export function DemoEntryPage() {
  const router = useRouter();
  const { enterDemo } = useAppState();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void enterDemo()
      .then(() => {
        if (!cancelled) router.replace("/scan/new");
      })
      .catch((demoError: unknown) => {
        if (!cancelled) {
          setError(demoError instanceof Error ? demoError.message : "The demo workspace is unavailable.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enterDemo, router]);

  return (
    <main className="page-shell compact-page" id="main">
      <section className="panel auth-panel" aria-live="polite">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Demo workspace</p>
            <h1>Preparing your sample scan</h1>
            <p>{error || "A fictional face image and example routine are being loaded."}</p>
          </div>
          <ScanFace size={28} aria-hidden="true" />
        </div>
      </section>
    </main>
  );
}
