"use client";

import type {
  Experiment,
  RoutineRecommendation,
  Scan,
  ScanActivityEvent,
  ScanUploadSession,
  SkinSimulation
} from "@skincause/contracts";
import {
  classifyCosmeticConcern,
  insufficientResult,
  seededExperiment,
  scans,
  persistentDisclaimer
} from "@skincause/domain";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  CloudSun,
  Download,
  Droplets,
  Eye,
  FileJson,
  Flame,
  FlaskConical,
  Focus,
  ImageOff,
  ListRestart,
  LockKeyhole,
  PackagePlus,
  Pause,
  Plus,
  Printer,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Waves,
  XCircle
} from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { useAppState } from "./app-provider";
import { YouCamCameraKit } from "./youcam-camera-kit";

const experimentId = "brightening-serum-elimination";
const aiCandidateProductId = "__ai_candidate_product__";

type ScanStatusResponse = {
  scanId: string;
  status: Scan["status"];
  pollAfterMs?: number;
  result?: Scan;
  activity?: ScanActivityEvent[];
  error?: { code: string; message: string; retryable: boolean };
};

type ScanWorkflowStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "uploading"
  | "processing"
  | "done"
  | "failed";

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "The request could not be completed.");
  }
  return payload.data;
}

async function waitForScan(
  scanId: string,
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  onActivity: (activity: ScanActivityEvent[]) => void
): Promise<Scan> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const scan = await readApiResponse<ScanStatusResponse>(
      await apiFetch(`/api/v1/scans/${encodeURIComponent(scanId)}`, { cache: "no-store" })
    );
    onActivity(scan.activity ?? []);
    if (scan.result && ["succeeded", "normalized"].includes(scan.status)) return scan.result;
    if (["provider_failed", "validation_failed", "upload_failed", "timed_out"].includes(scan.status)) {
      throw new Error(scan.error?.message ?? "The image could not be analyzed.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, scan.pollAfterMs ?? 500));
  }
  throw new Error("The analysis is taking longer than expected. You can safely resume it later.");
}

function localActivity(
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

function mergeActivity(current: ScanActivityEvent[], incoming: ScanActivityEvent[]) {
  const existingIds = new Set(current.map((event) => event.id));
  return [
    ...current,
    ...incoming.filter((event) => !existingIds.has(event.id))
  ].slice(-80);
}

function orderedConcerns(scan: Scan) {
  const order = new Map([
    ["redness", 0],
    ["blemish_pattern", 1],
    ["texture", 2],
    ["pores", 3],
    ["oiliness", 4],
    ["hydration", 5],
    ["radiance", 6]
  ]);
  return [...scan.concerns].sort(
    (left, right) => (order.get(left.key) ?? 99) - (order.get(right.key) ?? 99)
  );
}

function ConcernScoreIcon({ concernKey }: { concernKey: string }) {
  if (concernKey === "pores" || concernKey === "pore") {
    return <CircleDot size={18} aria-hidden="true" />;
  }
  if (concernKey === "texture") {
    return <Waves size={18} aria-hidden="true" />;
  }
  if (concernKey === "hydration" || concernKey === "oiliness") {
    return <Droplets size={18} aria-hidden="true" />;
  }
  if (concernKey === "radiance") {
    return <Sparkles size={18} aria-hidden="true" />;
  }
  if (concernKey === "blemish_pattern") {
    return <CircleDot size={18} aria-hidden="true" />;
  }
  return <Flame size={18} aria-hidden="true" />;
}

function initialConcernKey(scan: Scan) {
  return scan.concerns.find((concern) => concern.maskUrl)?.key ?? null;
}

async function readBrowserImageDimensions(file: File) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error("The image dimensions could not be read."));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export function ConsentPage() {
  const router = useRouter();
  const { consented, retainImages, setConsented, setRetainImages } = useAppState();
  const [accepted, setAccepted] = useState(consented);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) return;
    setConsented(true);
    router.push("/onboarding");
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading eyebrow="Step 1 of 4" title="Before we begin" description="Know what is processed, what is saved, and where the limits are." />
      <form className="dashboard-grid" onSubmit={submit}>
        <div>
          <section className="panel">
            <div className="panel-header">
              <div><h2>Cosmetic tracking only</h2><p>This tool organizes repeated observations. It does not diagnose or recommend treatment.</p></div>
              <ShieldCheck size={28} aria-hidden="true" />
            </div>
            <div className="promise-list">
              <ConsentItem icon={Camera} title="What is processed">
                A front-facing photo is sent through SkinCause&apos;s server to the configured skin-analysis processor. The browser never receives provider credentials.
              </ConsentItem>
              <ConsentItem icon={Sparkles} title="What is retained">
                Normalized concern scores and capture-quality notes are stored for your timeline. They may remain after the original image is deleted.
              </ConsentItem>
              <ConsentItem icon={Trash2} title="Your controls">
                Delete individual original images, export your investigation, or delete the entire workspace from the Privacy Center.
              </ConsentItem>
            </div>
          </section>
          <section className="panel">
            <div className="toggle-row">
              <div>
                <strong>Retain original scan images</strong>
                <p className="muted">
                  Off by default. Derived scores still work in your timeline. A retained baseline
                  image is required only if you choose to generate an illustrative skin simulation.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                className="toggle"
                aria-label="Retain original scan images"
                aria-checked={retainImages}
                onClick={() => setRetainImages(!retainImages)}
              />
            </div>
          </section>
        </div>
        <aside>
          <section className="panel next-action">
            <p className="eyebrow">Consent version 2026-07-24</p>
            <h2>Your acknowledgement</h2>
            <p>{persistentDisclaimer}</p>
            <label className="check-row">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>I understand the cosmetic-only scope and consent to image processing for this investigation.</span>
            </label>
            <button className="button" type="submit" disabled={!accepted}>
              Continue to routine <ArrowRight size={18} />
            </button>
          </section>
        </aside>
      </form>
    </main>
  );
}

function ConsentItem({
  icon: Icon,
  title,
  children
}: {
  icon: typeof Camera;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="promise-item">
      <span className="promise-icon"><Icon size={20} /></span>
      <div><h3>{title}</h3><p>{children}</p></div>
    </div>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { authStatus, products, addProduct } = useAppState();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaveError("");
    try {
      await addProduct({
        name: String(data.get("name")),
        brand: String(data.get("brand")),
        category: String(data.get("category")),
        startedAt: new Date(String(data.get("startedAt"))).toISOString(),
        cadence: "daily",
        timeOfDay: String(data.get("timeOfDay")) as "AM" | "PM" | "AM + PM",
        active: true,
        recentlyChanged: data.get("recentlyChanged") === "on"
      });
      form.reset();
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The product could not be saved.");
    }
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading
        eyebrow="Step 2 of 4"
        title="Reconstruct your routine"
        description="Dates matter more than ingredient guesses. Add each current product and mark what changed recently."
      />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div><h2>Quick-add a product</h2><p>Start with the products you use most consistently.</p></div>
            <PackagePlus size={26} />
          </div>
          <form className="form-grid" onSubmit={submit}>
            <div className="field">
              <label htmlFor="product-name">Product name</label>
              <input id="product-name" name="name" placeholder="e.g. Barrier moisturizer" required />
            </div>
            <div className="field">
              <label htmlFor="brand">Brand</label>
              <input id="brand" name="brand" placeholder="Optional" />
            </div>
            <div className="field">
              <label htmlFor="category">Routine slot</label>
              <select id="category" name="category" defaultValue="Serum">
                <option>Cleanser</option><option>Serum</option><option>Moisturizer</option><option>Sunscreen</option><option>Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="started-at">Started using</label>
              <input id="started-at" name="startedAt" type="date" defaultValue="2026-07-20" required />
            </div>
            <div className="field">
              <label htmlFor="time-of-day">Time of day</label>
              <select id="time-of-day" name="timeOfDay" defaultValue="PM">
                <option>AM</option><option>PM</option><option>AM + PM</option>
              </select>
            </div>
            <label className="check-row">
              <input type="checkbox" name="recentlyChanged" />
              <span>Introduced or changed recently</span>
            </label>
            <div className="field full row-actions">
              <button className="button" type="submit"><Plus size={18} /> Add to routine</button>
              <button className="button button-secondary" type="button" onClick={() => router.push("/scan/new")}>
                Continue to baseline <ArrowRight size={18} />
              </button>
            </div>
            {saveError ? <p className="form-error field full" role="alert">{saveError}</p> : null}
          </form>
        </section>
        <aside>
          <section className="panel">
            <div className="panel-header">
              <div><h2>Current routine</h2><p>{products.length} products recorded</p></div>
              <span className="status-pill success"><Check size={13} /> Ready</span>
            </div>
            <div className="routine-lock">
              {products.map((product) => (
                <div className="lock-row" key={product.id}>
                  <div><strong>{product.name}</strong><small>{product.category} · {product.timeOfDay}</small></div>
                  {product.recentlyChanged && <span className="status-pill warning">Recent</span>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {saved && <Toast text={authStatus === "authenticated" ? "Product saved to your workspace." : "Product added to this guest workspace."} />}
    </main>
  );
}

export function DashboardPage() {
  const { products, checkInSaved } = useAppState();
  const result = seededExperiment.result;
  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Dashboard</h1>
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Brightening serum elimination</p>
                <h2>Redness and texture trend</h2>
                <p>Baseline compared with three standardized follow-ups.</p>
              </div>
              <span className="status-pill success"><CheckCircle2 size={14} /> Completed</span>
            </div>
            <div className="trend-layout">
              <ScoreDisc score={result.score ?? 0} label="evidence score" />
              <div>
                <div className="trend-chart" role="img" aria-label="Redness severity decreased from 68 at baseline to 43 at follow-up three">
                  {[68, 58, 47, 43].map((value, index) => (
                    <div className="trend-column" key={value}>
                      <div className="trend-bar" style={{ height: `${value}%` }} title={`${value}`} />
                      <span>{index === 0 ? "Baseline" : `Day ${index * 5}`}</span>
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 36 }}>Redness severity decreased 25 points across the available mock scans.</p>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h2>Investigation timeline</h2><p>Routine change, check-ins, and scan context in one view.</p></div>
              <Link className="button button-quiet button-small" href={`/experiments/${experimentId}`}>Full timeline <ArrowRight size={16} /></Link>
            </div>
            <div className="timeline">
              <TimelineItem date="Jun 09" title="Experiment started" detail="Brightening Serum paused; two products locked." tag="Plan" />
              {seededExperiment.checkIns.map((item) => (
                <TimelineItem
                  key={item.id}
                  date={item.date}
                  title={`Day ${item.day} check-in`}
                  detail={item.confounder ?? `100% adherence · observation ${item.observation}/10`}
                  tag={item.confounder ? "Confounder" : "Scan"}
                />
              ))}
              {checkInSaved && <TimelineItem date="Today" title="New check-in saved" detail="Guest-only entry preserved on this device." tag="Local" />}
            </div>
          </section>
        </div>
        <aside>
          <section className="panel next-action">
            <p className="eyebrow">Next best action</p>
            <h2>Review the evidence</h2>
            <p>{result.wording}</p>
            <Link className="button" href={`/results/${experimentId}`}>Open result <ArrowRight size={18} /></Link>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h3>Routine lock</h3><p>One planned change</p></div>
              <LockKeyhole size={22} />
            </div>
            <div className="routine-lock">
              {products.map((product) => (
                <div className="lock-row" key={product.id}>
                  <div><strong>{product.name}</strong><small>{product.timeOfDay} · {product.active ? "unchanged" : "paused"}</small></div>
                  {product.id === "brightening-serum" ? <Pause size={17} /> : <Check size={17} />}
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h3>Analysis provider</h3><p>Deterministic demo mode</p></div>
              <ScanFace size={22} />
            </div>
            <span className="status-pill success">YouCam-compatible mock</span>
            <p className="muted" style={{ marginTop: 12 }}>Upload → task → poll → normalized concern scores. No API units used in demo mode.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export function ProductsPage() {
  const { products, toggleProduct } = useAppState();
  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Routine</h1>
      <section className="panel">
        <div className="panel-header">
          <div><h2>Routine products</h2><p>Current products and usage status.</p></div>
          <Link className="button button-small" href="/onboarding"><Plus size={18} /> Add product</Link>
        </div>
        <div className="product-list">
          {products.map((product) => (
            <div className="product-row" key={product.id}>
              <span className="product-swatch"><Droplets size={19} /></span>
              <div>
                <strong>{product.name}</strong>
                <small>{product.brand || "Unbranded"} · {product.category} · started {new Date(product.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
              </div>
              <span className={product.active ? "status-pill success" : "status-pill warning"}>
                {product.active ? "Active" : "Paused"}
              </span>
              <button className="button button-secondary button-small" onClick={() => toggleProduct(product.id)}>
                {product.active ? "Pause" : "Restart"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="callout" style={{ marginTop: 20 }}>
        <strong>Audit-minded history</strong>
        <p className="muted">Changes made here are recorded as new usage periods in the production data model.</p>
      </div>
    </main>
  );
}

export function ScanPage() {
  const router = useRouter();
  const { apiFetch, demoMode, retainImages } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<Scan | null>(null);
  const [activeConcern, setActiveConcern] = useState<string | null>(null);
  const [usingDemoImage, setUsingDemoImage] = useState(false);
  const [capturedWithCameraKit, setCapturedWithCameraKit] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ScanWorkflowStatus>("idle");
  const [activity, setActivity] = useState<ScanActivityEvent[]>([]);

  useEffect(() => {
    const activeId = window.localStorage.getItem("skincause-active-scan");
    if (!activeId) return;
    let cancelled = false;
    const resume = async () => {
      setStatus("processing");
      setActivity((current) => mergeActivity(current, [
        localActivity("client", "resuming persisted scan status polling")
      ]));
      try {
        const resumedResult = await waitForScan(activeId, apiFetch, (events) => {
          setActivity((current) => mergeActivity(current, events));
        });
        if (cancelled) return;
        setResult(resumedResult);
        setActiveConcern(initialConcernKey(resumedResult));
        setStatus("done");
        window.localStorage.setItem("skincause-latest-scan", activeId);
        window.localStorage.removeItem("skincause-active-scan");
      } catch (resumeError) {
        if (cancelled) return;
        setError(resumeError instanceof Error ? resumeError.message : "The scan could not be resumed.");
        setActivity((current) => mergeActivity(current, [
          localActivity("client", "scan polling interrupted", "error")
        ]));
        setStatus("failed");
        window.localStorage.removeItem("skincause-active-scan");
      }
    };
    void resume();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  async function loadDemoImage() {
    setError("");
    setStatus("preparing");
    try {
      const blob = await fetch("/images/demo-face-v3.png")
      .then((response) => {
        if (!response.ok) throw new Error("The demo image could not be loaded.");
        return response.blob();
      });
      const file = new File([blob], "skincause-asian-skin-test.png", { type: "image/png" });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
      setUsingDemoImage(true);
      setCapturedWithCameraKit(false);
      setResult(null);
      setActiveConcern(null);
      setStatus("ready");
      setActivity([
        localActivity(
          "client",
          `validated image/png; ${blob.size} bytes`,
          "success"
        )
      ]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The demo image could not be loaded.");
      setStatus("failed");
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const chooseFile = useCallback(async (file?: File) => {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Upload a JPG or PNG image.");
      setActivity((current) => mergeActivity(current, [
        localActivity("client", "image validation rejected: unsupported format", "error")
      ]));
      return;
    }
    if (file.size >= 10_000_000) {
      setError("Choose an image smaller than 10 MB.");
      setActivity((current) => mergeActivity(current, [
        localActivity("client", "image validation rejected: file exceeds 10 MB", "error")
      ]));
      return;
    }
    try {
      const dimensions = await readBrowserImageDimensions(file);
      if (Math.min(dimensions.width, dimensions.height) < 480) {
        setError("Choose an image at least 480 pixels on its shortest side.");
        setActivity((current) => mergeActivity(current, [
          localActivity("client", "image validation rejected: dimensions below SD minimum", "error")
        ]));
        return;
      }
    } catch {
      setError("The image could not be read. Choose another JPG or PNG.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setUsingDemoImage(false);
    setCapturedWithCameraKit(false);
    setResult(null);
    setActiveConcern(null);
    setStatus("ready");
    setActivity([
      localActivity(
        "client",
        `validated ${file.type}; ${file.size} bytes`,
        "success"
      )
    ]);
  }, []);

  const acceptCameraKitCapture = useCallback(async (file: File) => {
    await chooseFile(file);
    setCapturedWithCameraKit(true);
  }, [chooseFile]);

  async function submitScan() {
    if (!selectedFile) return;
    setError("");
    try {
      const clientRequestId = crypto.randomUUID();
      setStatus("uploading");
      setActivity((current) => mergeActivity(current, [
        localActivity("client", "POST /api/v1/scans/upload-sessions")
      ]));
      const uploadSession = await readApiResponse<ScanUploadSession>(
        await apiFetch("/api/v1/scans/upload-sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientRequestId,
            mimeType: selectedFile.type,
            byteSize: selectedFile.size,
            fileName: selectedFile.name,
            retainImage: retainImages
          })
        })
      );
      setActivity((current) => mergeActivity(current, [
        ...(uploadSession.activity ?? []),
        localActivity("skincause", "HTTP 201; private upload session created", "success")
      ]));
      window.localStorage.setItem("skincause-active-scan", uploadSession.scanId);

      if (uploadSession.upload.type === "supabase-signed") {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("Secure image storage is not configured.");
        const { error: uploadError } = await client.storage
          .from(uploadSession.upload.bucket)
          .uploadToSignedUrl(
            uploadSession.upload.path,
            uploadSession.upload.token,
            selectedFile,
            { contentType: selectedFile.type }
          );
        if (uploadError) throw new Error("The image could not be uploaded securely.");
        setActivity((current) => mergeActivity(current, [
          localActivity(
            "storage",
            `signed upload completed; ${selectedFile.size} bytes stored privately`,
            "success"
          )
        ]));
      } else {
        await readApiResponse(
          await apiFetch(uploadSession.upload.url, {
            method: uploadSession.upload.method,
            headers: uploadSession.upload.requiredHeaders,
            body: selectedFile
          })
        );
        setActivity((current) => mergeActivity(current, [
          localActivity(
            "storage",
            `PUT same-origin upload -> 200; ${selectedFile.size} bytes stored`,
            "success"
          )
        ]));
      }
      const submitted = await readApiResponse<ScanStatusResponse>(
        await apiFetch(`/api/v1/scans/${encodeURIComponent(uploadSession.scanId)}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientRequestId,
            captureSource: capturedWithCameraKit ? "camera-kit" : "upload"
          })
        })
      );
      setActivity((current) => mergeActivity(current, submitted.activity ?? []));
      setStatus("processing");
      const completed = await waitForScan(uploadSession.scanId, apiFetch, (events) => {
        setActivity((current) => mergeActivity(current, events));
      });
      setResult(completed);
      setActiveConcern(initialConcernKey(completed));
      setStatus("done");
      window.localStorage.setItem("skincause-latest-scan", uploadSession.scanId);
      window.localStorage.removeItem("skincause-active-scan");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The scan could not be completed.");
      setActivity((current) => mergeActivity(current, [
        localActivity("client", "scan workflow interrupted; safe error returned", "error")
      ]));
      setStatus("failed");
    }
  }

  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Scan</h1>
      <div className="scan-grid">
        <section className={previewUrl ? "capture-zone has-image" : "capture-zone"}>
          {previewUrl && status === "done" && result ? (
            <ConcernVisualization
              scan={result}
              imageUrl={previewUrl}
              activeConcern={activeConcern}
              onSelectConcern={setActiveConcern}
            />
          ) : previewUrl ? (
            <div
              className="demo-face-preview"
              role="img"
              aria-label={demoMode ? "Prepared synthetic skin-analysis test face" : `Preview of ${fileName}`}
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          ) : (
            <div>
              <div className="face-guide" aria-hidden="true"><Focus size={50} /></div>
              <p style={{ marginTop: 18, marginBottom: 4 }}><strong>Center your face inside the guide</strong></p>
              <p className="muted">Face fills 60–80% · even front lighting · neutral expression · eyes open</p>
            </div>
          )}
        </section>
        <aside className="scan-instructions">
          <AnalysisActivity status={status} result={result} activity={activity} />
          <section className="panel">
            <input
              className="upload-input"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
              aria-label="Choose a JPG or PNG image"
            />
            {status === "idle" ? <YouCamCameraKit onCapture={acceptCameraKitCapture} /> : null}
            {usingDemoImage && status === "ready" ? (
              <div className="callout" role="status">
                <strong>Synthetic test image ready</strong>
                <p className="muted">This AI-generated portrait is prepared for a live skin-analysis scan.</p>
              </div>
            ) : null}
            {error && <div className="callout danger" role="alert" style={{ marginTop: 14 }}>{error}</div>}
            {(fileName || status === "ready") && !error && (
              <div className="quality-box" style={{ marginTop: 14 }}>
                <strong>{fileName || "Resumable scan found"}</strong>
                <p className="muted">Format, file size, and SD dimensions passed. Final face and lighting checks occur during analysis.</p>
              </div>
            )}
            {status === "idle" ? (
              <div className="quality-box" style={{ marginTop: 14 }}>
                <strong>For repeatable measurements</strong>
                <p className="muted">Use the same camera and lighting each time. Keep hair off your forehead and remove glasses or makeup when practical.</p>
              </div>
            ) : null}
            {status === "idle" && (
              <div className="scan-source-actions">
                <button className="button" onClick={() => fileRef.current?.click()}>
                  <Upload size={18} /> Upload your image
                </button>
                {demoMode ? (
                  <button className="button button-secondary" onClick={() => void loadDemoImage()}>
                    <ScanFace size={18} /> Use demo image
                  </button>
                ) : null}
              </div>
            )}
            {status === "preparing" && (
              <div aria-live="polite" style={{ marginTop: 18 }}>
                <p className="eyebrow">Preparing demo image</p>
                <div className="bar"><span style={{ width: "58%" }} /></div>
              </div>
            )}
            {status === "ready" && (
              <div className="scan-ready-actions">
                <button className="button" onClick={() => void submitScan()}>
                  <ScanFace size={18} /> {usingDemoImage ? "Analyze demo image" : "Analyze image"}
                </button>
                <button className="button button-secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={18} /> Choose another image
                </button>
              </div>
            )}
            {(status === "uploading" || status === "processing") && (
              <div aria-live="polite" style={{ marginTop: 18 }}>
                <p className="eyebrow">{status === "uploading" ? "Uploading securely" : "Normalizing measurements"}</p>
                <div className="bar"><span style={{ width: status === "uploading" ? "38%" : "78%" }} /></div>
                <p className="muted" style={{ marginTop: 10 }}>This scan ID is persisted so a refresh resumes status instead of creating a duplicate task.</p>
              </div>
            )}
            {status === "done" && (
              <div aria-live="polite" style={{ marginTop: 18 }}>
                <div className="quality-box">
                  <span className={`result-provenance result-provenance-${result?.provider ?? "unknown"}`}>
                    {result?.provider === "youcam"
                      ? `Live YouCam ${result.providerVersion ?? "provider"} response`
                      : "Agent test result"}
                  </span>
                  <strong>Scan complete</strong>
                  <div className="scan-score-list" data-testid="provider-score-summary">
                    {result ? orderedConcerns(result).map((concern) => {
                      const assessment = classifyCosmeticConcern(concern.normalizedSeverity);
                      return (
                        <div
                          className={`scan-score-row scan-score-${concern.key}`}
                          key={concern.key}
                        >
                          <ConcernScoreIcon concernKey={concern.key} />
                          <span className="scan-score-label">{concern.displayLabel ?? concern.providerLabel}</span>
                          <strong>
                            {concern.normalizedSeverity === null
                              ? "n/a"
                              : Math.round(concern.normalizedSeverity)}
                          </strong>
                          <div className={`scan-score-assessment assessment-${assessment.level}`}>
                            {assessment.label}
                          </div>
                        </div>
                      );
                    }) : null}
                  </div>
                </div>
                <button className="button" style={{ width: "100%", marginTop: 16 }} onClick={() => router.push("/experiments/new")}>
                  Plan experiment <ArrowRight size={18} />
                </button>
              </div>
            )}
            {status === "failed" && (
              <button className="button button-secondary" style={{ width: "100%", marginTop: 16 }} onClick={() => {
                setStatus("idle");
                setError("");
                setSelectedFile(null);
                setPreviewUrl("");
                setFileName("");
                setUsingDemoImage(false);
                setCapturedWithCameraKit(false);
                setResult(null);
                setActiveConcern(null);
                setActivity([]);
              }}>
                Try another image
              </button>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function AnalysisActivity({
  status,
  result,
  activity
}: {
  status: ScanWorkflowStatus;
  result: Scan | null;
  activity: ScanActivityEvent[];
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const isRunning = status === "uploading" || status === "processing";

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [activity]);

  const badge = status === "done"
    ? result?.provider === "youcam" ? "Live YouCam response" : "Agent test mode"
    : status === "processing"
      ? "Provider active"
      : status === "uploading"
        ? "Uploading"
        : status === "failed"
          ? "Failed"
          : status === "ready"
            ? "Ready"
            : "Idle";

  return (
    <section className="panel analysis-activity-panel">
      <div className="panel-header">
        <div>
          <h2>Live execution log</h2>
          <p>Sanitized events emitted by this scan.</p>
        </div>
        <span className={`status-pill activity-badge activity-badge-${status}`}>{badge}</span>
      </div>
      <div
        className="analysis-terminal"
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Scan execution activity"
      >
        {activity.length === 0 ? (
          <div className="terminal-line terminal-line-muted">
            <time>--:--:--</time>
            <p><span className="terminal-prompt">$</span> waiting for an image</p>
          </div>
        ) : activity.map((event) => {
          const displaySource = event.source === "mock" ? "agent" : event.source;
          return (
            <div
              className={`terminal-line terminal-line-${event.level}`}
              key={event.id}
            >
              <time dateTime={event.at}>
                {new Date(event.at).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </time>
              <p>
                <span className="terminal-prompt">$</span>{" "}
                <span className={`terminal-source terminal-source-${displaySource}`}>
                  [{displaySource}]
                </span>{" "}
                {event.message}
              </p>
            </div>
          );
        })}
        {isRunning ? (
          <div className="terminal-line terminal-line-cursor" aria-label="Command running">
            <time>{new Date().toLocaleTimeString("en-US", { hour12: false })}</time>
            <p><span className="terminal-prompt">$</span> <span className="terminal-cursor" /></p>
          </div>
        ) : null}
      </div>
      <p className="analysis-log-safety">
        Provider credentials, task IDs, image URLs, and authorization headers stay hidden.
      </p>
    </section>
  );
}

function ConcernVisualization({
  scan,
  imageUrl,
  activeConcern,
  onSelectConcern
}: {
  scan: Scan;
  imageUrl: string;
  activeConcern: string | null;
  onSelectConcern: (key: string | null) => void;
}) {
  const active = scan.concerns.find((concern) => concern.key === activeConcern);
  const overlayUrl = active?.maskUrl;
  const availableConcerns = orderedConcerns(scan).filter((concern) => concern.maskUrl);

  return (
    <div className="concern-visualization">
      <div className="segmentation-heading">
        <strong>Facial segmentation</strong>
        <span>{availableConcerns.length} provider mask overlays</span>
      </div>
      <div className="concern-image-stack">
        <div
          className="concern-base-image"
          role="img"
          aria-label={active
            ? `${active.displayLabel ?? active.providerLabel} visual pattern overlay on the analyzed image`
            : "Original analyzed image"}
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        {overlayUrl ? (
          <div
            className="concern-provider-overlay"
            aria-hidden="true"
            style={{ backgroundImage: `url(${overlayUrl})` }}
          />
        ) : null}
        <span className="concern-visual-label">
          {active
            ? `${active.displayLabel ?? active.providerLabel} observed pattern`
            : "Original image"}
        </span>
      </div>
      {availableConcerns.length > 0 ? (
        <>
          <div className="concern-controls" aria-label="Scan image view">
            <button
              className={activeConcern === null ? "is-active" : ""}
              type="button"
              aria-pressed={activeConcern === null}
              onClick={() => onSelectConcern(null)}
            >
              Original
            </button>
            {availableConcerns.map((concern) => (
              <button
                className={activeConcern === concern.key ? "is-active" : ""}
                type="button"
                aria-pressed={activeConcern === concern.key}
                key={concern.key}
                onClick={() => onSelectConcern(concern.key)}
              >
                <span className={`concern-swatch concern-swatch-${concern.key}`} aria-hidden="true" />
                {concern.displayLabel ?? concern.providerLabel}
              </button>
            ))}
          </div>
          <p className="concern-visual-note">
            Highlights show AI-observed cosmetic patterns from this scan, not a diagnosis.
            Provider overlays are temporary and are not retained after this result view.
          </p>
        </>
      ) : (
        <div className="concern-unavailable" role="status">
          <ImageOff size={18} />
          <span>Location data was not returned for this scan. Scores remain available.</span>
        </div>
      )}
    </div>
  );
}

export function ExperimentPlannerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addProduct, apiFetch, authStatus, products } = useAppState();
  const [type, setType] = useState<"elimination" | "reintroduction">("elimination");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState<Scan | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedMeasurements, setSelectedMeasurements] = useState<string[] | null>(null);
  const [hypothesis, setHypothesis] = useState(
    "Observe whether the selected visible patterns change while this one routine step is adjusted."
  );
  const [appliedRecommendation, setAppliedRecommendation] =
    useState<RoutineRecommendation | null>(null);
  const stagedCandidateIdRef = useRef<string | null>(null);
  const evidenceExperimentId =
    searchParams.get("from") ?? (authStatus === "authenticated" ? null : experimentId);
  const availableConcerns = (baseline?.concerns ?? scans[0].concerns)
    .filter((concern) => concern.experimentRole === "primary");
  const defaultMeasurementKeys = availableConcerns.slice(0, 2).map((concern) => concern.key);
  const selectedMeasurementKeys = selectedMeasurements ?? defaultMeasurementKeys;
  const effectiveProductId = selectedProductId || products[0]?.id || "";

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const scanId = window.localStorage.getItem("skincause-latest-scan");
    if (!scanId) {
      const timer = window.setTimeout(() => {
        setError("Complete a baseline scan before planning an experiment.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    void apiFetch(`/api/v1/scans/${encodeURIComponent(scanId)}`, { cache: "no-store" })
      .then((response) => readApiResponse<ScanStatusResponse>(response))
      .then((scan) => {
        if (!scan.result) throw new Error("The baseline scan is not ready.");
        setBaseline(scan.result);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "The baseline scan could not be loaded.");
      });
  }, [apiFetch, authStatus]);

  function applyRoutineRecommendation(recommendation: RoutineRecommendation) {
    const availableKeys = new Set(availableConcerns.map((concern) => concern.key));
    const recommendedMeasurements = recommendation.measurementKeys
      .filter((key) => availableKeys.has(key))
      .slice(0, 3);
    if (recommendedMeasurements.length > 0) {
      setSelectedMeasurements(recommendedMeasurements);
    }

    if (
      (recommendation.action === "replace" || recommendation.action === "add") &&
      recommendation.candidateProduct
    ) {
      setType("reintroduction");
      setSelectedProductId(aiCandidateProductId);
    } else if (recommendation.existingProductId) {
      if (recommendation.action === "remove") setType("elimination");
      setSelectedProductId(recommendation.existingProductId);
    }

    setHypothesis(recommendation.summary);
    setAppliedRecommendation(recommendation);
    stagedCandidateIdRef.current = null;
    setError("");
  }

  function toggleMeasurement(key: string) {
    setSelectedMeasurements((current) => {
      const selected = current ?? defaultMeasurementKeys;
      return selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key].slice(0, 3);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authStatus !== "authenticated") {
      router.push(`/experiments/${experimentId}`);
      return;
    }
    const data = new FormData(event.currentTarget);
    const primaryConcerns = data.getAll("primaryConcerns").map(String);
    if (!baseline || primaryConcerns.length === 0) {
      setError("Choose at least one baseline measurement.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const startedAt = new Date(String(data.get("startedAt"))).toISOString();
      let suspectProductId = String(data.get("suspectProductId"));
      if (suspectProductId === aiCandidateProductId) {
        const candidate = appliedRecommendation?.candidateProduct;
        if (!candidate) {
          throw new Error("Generate an AI routine suggestion before selecting a new product.");
        }
        const matchingProduct = products.find((product) =>
          product.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() &&
          product.brand.trim().toLowerCase() === candidate.brand.trim().toLowerCase()
        );
        if (matchingProduct) {
          suspectProductId = matchingProduct.id;
        } else if (stagedCandidateIdRef.current) {
          suspectProductId = stagedCandidateIdRef.current;
        } else {
          const replacedProduct = appliedRecommendation.existingProductId
            ? products.find((product) => product.id === appliedRecommendation.existingProductId)
            : null;
          const createdCandidate = await addProduct({
            name: candidate.name,
            brand: candidate.brand,
            category: candidate.category,
            startedAt,
            cadence: replacedProduct?.cadence ?? "daily",
            timeOfDay: replacedProduct?.timeOfDay ?? "PM",
            active: true,
            recentlyChanged: true
          });
          stagedCandidateIdRef.current = createdCandidate.id;
          suspectProductId = createdCandidate.id;
        }
      }
      const experiment = await readApiResponse<Experiment>(
        await apiFetch("/api/v1/experiments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type,
            suspectProductId,
            startedAt,
            hypothesis: String(data.get("hypothesis")),
            baselineScanId: baseline.id,
            analysisProfileVersion: baseline.analysisProfileVersion ?? "routine-sd-v1",
            primaryConcerns
          })
        })
      );
      window.localStorage.setItem("skincause-active-experiment", experiment.id);
      window.localStorage.removeItem("skincause-latest-scan");
      router.push(`/experiments/${experiment.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The experiment could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading eyebrow="Step 4 of 4" title="Plan one clear change" description="Select one suspect product. Every other routine step becomes a locked snapshot for the duration of the investigation." />
      <form onSubmit={submit}>
        <div className="planner-stack">
          <section className="panel">
            <div className="form-grid">
            <div className="field full">
              <span className="field-label">Planned change</span>
              <div className="segmented" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <button type="button" className={type === "elimination" ? "is-active" : ""} onClick={() => setType("elimination")}>Suspend product</button>
                <button type="button" className={type === "reintroduction" ? "is-active" : ""} onClick={() => setType("reintroduction")}>Add / replace product</button>
              </div>
            </div>
            <div className="field full">
              <label htmlFor="suspect">Suspect product</label>
              <select
                id="suspect"
                name="suspectProductId"
                value={effectiveProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                required
              >
                {products.map((product) => <option value={product.id} key={product.id}>{product.name}{product.recentlyChanged ? " · recently changed" : ""}</option>)}
                {appliedRecommendation?.candidateProduct ? (
                  <option value={aiCandidateProductId}>
                    AI replacement · {appliedRecommendation.candidateProduct.brand}{" "}
                    {appliedRecommendation.candidateProduct.name}
                  </option>
                ) : null}
              </select>
              {appliedRecommendation ? (
                <small className="ai-applied-note">
                  AI applied: {recommendationActionLabel(appliedRecommendation.action)}
                  {appliedRecommendation.candidateProduct
                    ? ` · ${appliedRecommendation.candidateProduct.brand} ${appliedRecommendation.candidateProduct.name}`
                    : ""}
                </small>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="start-date">Start date</label>
              <input id="start-date" name="startedAt" type="date" defaultValue="2026-07-24" required />
            </div>
            <div className="field full">
              <span className="field-label">Measurements to compare</span>
              <div className="form-grid">
                {availableConcerns.map((concern) => (
                    <label className="check-row" key={concern.key}>
                      <input
                        type="checkbox"
                        name="primaryConcerns"
                        value={concern.key}
                        checked={selectedMeasurementKeys.includes(concern.key)}
                        onChange={() => toggleMeasurement(concern.key)}
                      />
                      <span>{concern.displayLabel ?? concern.providerLabel}</span>
                    </label>
                  ))}
              </div>
              <small>These measurements are locked to the baseline profile for every follow-up.</small>
            </div>
            <div className="field full">
              <label htmlFor="hypothesis">What are you trying to observe?</label>
              <textarea
                id="hypothesis"
                name="hypothesis"
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                required
              />
            </div>
            </div>
            {evidenceExperimentId ? (
              <ExperimentAiTools
                id={evidenceExperimentId}
                onApplyRecommendation={applyRoutineRecommendation}
              />
            ) : (
              <section className="experiment-ai-panel experiment-ai-panel--embedded">
                <p className="eyebrow"><Sparkles size={13} /> AI-assisted next change</p>
                <h2>Available after your first completed experiment</h2>
                <p className="muted">
                  OpenAI uses recorded experiment evidence to suggest an addition, removal, or
                  replacement. YouCam needs a retained baseline and comparable follow-up scan to
                  generate the illustrative after-experiment image.
                </p>
              </section>
            )}
            <div className="planner-submit">
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <button className="button" type="submit" disabled={busy || products.length === 0}>
                {busy ? "Starting..." : "Start investigation"} <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      </form>
    </main>
  );
}

export function CheckInPage() {
  const router = useRouter();
  const { apiFetch, authStatus, saveCheckIn } = useAppState();
  const [adherence, setAdherence] = useState("all");
  const [observation, setObservation] = useState(5);
  const [confounders, setConfounders] = useState<string[]>([]);
  const [concerning, setConcerning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedExperimentId, setSavedExperimentId] = useState(experimentId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleConfounder = (value: string) =>
    setConfounders((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (concerning) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      let activeExperimentId = window.localStorage.getItem("skincause-active-experiment");
      if (authStatus === "authenticated" && !activeExperimentId) {
        const experiments = await readApiResponse<Experiment[]>(
          await apiFetch("/api/v1/experiments", { cache: "no-store" })
        );
        activeExperimentId = experiments.find((experiment) => experiment.status === "active")?.id ?? null;
      }
      if (authStatus === "authenticated" && !activeExperimentId) {
        throw new Error("Start an experiment before saving a check-in.");
      }
      const targetExperimentId = activeExperimentId ?? experimentId;
      if (authStatus === "authenticated") {
        const notes = String(new FormData(form).get("notes") ?? "");
        const latestScanId = window.localStorage.getItem("skincause-latest-scan") ?? undefined;
        await readApiResponse(
          await apiFetch(`/api/v1/experiments/${encodeURIComponent(targetExperimentId)}/check-ins`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              adherence: adherence === "all" ? 100 : adherence === "most" ? 75 : 40,
              observation,
              confounders,
              notes,
              scanId: latestScanId
            })
          })
        );
        window.localStorage.removeItem("skincause-latest-scan");
      }
      saveCheckIn();
      setSavedExperimentId(targetExperimentId);
      setSaved(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The check-in could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Check in</h1>
      <form className="dashboard-grid" onSubmit={submit}>
        <div>
          <section className="panel">
            <div className="panel-header">
              <div><h2>Protocol adherence</h2><p>Did you follow the planned routine since your last check-in?</p></div>
              <CheckCircle2 size={24} />
            </div>
            <div className="segmented">
              {[
                ["all", "All days"],
                ["most", "Most days"],
                ["some", "Some days"]
              ].map(([value, label]) => (
                <button key={value} type="button" className={adherence === value ? "is-active" : ""} onClick={() => setAdherence(value)}>{label}</button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div><h2>Your observation</h2><p>Rate the selected cosmetic concern today.</p></div>
              <Eye size={24} />
            </div>
            <div className="range-wrap">
              <div className="metric-label"><span>Selected visible patterns or discomfort</span><strong>{observation}/10</strong></div>
              <input aria-label="Selected visible patterns or discomfort from 0 to 10" type="range" min="0" max="10" value={observation} onChange={(event) => setObservation(Number(event.target.value))} />
              <div className="range-labels"><span>None noticed</span><span>Most noticeable</span></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div><h2>Other changes</h2><p>Select anything that could make this check-in harder to interpret.</p></div>
              <CloudSun size={24} />
            </div>
            <div className="form-grid">
              {["Unusual sun exposure", "Poor sleep", "Travel or climate", "Another routine change"].map((value) => (
                <label className="check-row" key={value}>
                  <input type="checkbox" checked={confounders.includes(value)} onChange={() => toggleConfounder(value)} />
                  <span>{value}</span>
                </label>
              ))}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="notes">Optional note</label>
              <textarea id="notes" name="notes" placeholder="Keep this factual and brief." />
            </div>
          </section>
        </div>
        <aside>
          <section className="panel">
            <div className="panel-header"><div><h2>Follow-up scan</h2><p>Recommended for visible trend evidence.</p></div><ScanFace size={24} /></div>
            <Link className="button button-secondary" href="/scan/new"><Camera size={18} /> Add standardized scan</Link>
          </section>
          <section className="panel">
            <label className="check-row">
              <input type="checkbox" checked={concerning} onChange={(event) => setConcerning(event.target.checked)} />
              <span>I am experiencing severe, rapidly worsening, or otherwise concerning symptoms.</span>
            </label>
            {concerning && (
              <div className="callout danger" role="alert">
                <strong>Stop this experiment.</strong>
                <p>Discontinue the experiment and contact a qualified healthcare professional. SkinCause cannot evaluate concerning symptoms.</p>
              </div>
            )}
          </section>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button" type="submit" disabled={concerning || busy} style={{ width: "100%" }}>
            {busy ? "Saving..." : "Save check-in"} <Check size={18} />
          </button>
        </aside>
      </form>
      {saved && (
        <div className="toast" role="status">
          Check-in saved. <button className="button button-small" style={{ marginLeft: 10 }} onClick={() => router.push(`/experiments/${savedExperimentId}`)}>View timeline</button>
        </div>
      )}
    </main>
  );
}

export function ExperimentDetailPage({ id = experimentId }: { id?: string }) {
  const { authStatus, checkInSaved } = useAppState();
  if (authStatus === "authenticated") {
    return <AuthenticatedExperimentDetail id={id} />;
  }
  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Brightening serum elimination</h1>
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="panel-header">
              <div><h2>Redness comparison</h2><p>Normalized severity; greater values mean greater visible concern.</p></div>
              <span className="status-pill">Configured direction</span>
            </div>
            <div className="trend-chart" style={{ height: 250 }} role="img" aria-label="Redness severity decreased from 68 to 43">
              {[68, 58, 47, 43].map((value, index) => (
                <div className="trend-column" key={value}>
                  <strong>{value}</strong>
                  <div className="trend-bar" style={{ height: `${value}%` }} />
                  <span>{index === 0 ? "Baseline" : `Follow-up ${index}`}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header"><div><h2>Complete timeline</h2><p>Evidence and context appear together.</p></div><CalendarDays size={24} /></div>
            <div className="timeline">
              <TimelineItem date="Jun 08" title="Baseline captured" detail="Redness 68 · Texture 55 · Pores 42" tag="Scan" />
              <TimelineItem date="Jun 09" title="Serum paused" detail="Cleanser and moisturizer locked as routine snapshot." tag="Change" />
              {seededExperiment.checkIns.map((item) => (
                <TimelineItem key={item.id} date={item.date} title={`Follow-up ${item.day === 4 ? 1 : item.day === 9 ? 2 : 3}`} detail={item.confounder ?? `100% adherence · observation ${item.observation}/10`} tag={item.confounder ? "Confounder" : "Clean"} />
              ))}
              {checkInSaved && <TimelineItem date="Today" title="Local check-in" detail="Saved in this browser guest workspace." tag="Local" />}
              <TimelineItem date="Jun 24" title="Result generated" detail="Deterministic evidence score frozen from available inputs." tag="Result" />
            </div>
          </section>
        </div>
        <aside>
          <section className="panel next-action">
            <p className="eyebrow"><FlaskConical size={13} /> Experiment rule</p>
            <h2>One planned change</h2>
            <div className="routine-lock">
              <div className="lock-row"><div><strong>Brightening Serum</strong><small>Paused</small></div><Pause size={17} /></div>
              <div className="lock-row"><div><strong>Gentle Cleanser</strong><small>Locked</small></div><LockKeyhole size={17} /></div>
              <div className="lock-row"><div><strong>Barrier Moisturizer</strong><small>Locked</small></div><LockKeyhole size={17} /></div>
            </div>
            <Link className="button" href={`/results/${experimentId}`} style={{ marginTop: 16 }}>
              View result <ArrowRight size={18} />
            </Link>
          </section>
          <section className="panel">
            <h3>Known limitation</h3>
            <p className="muted">The Jun 18 check-in included unusual sun exposure, reducing confidence by eight points.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function recommendationActionLabel(action: RoutineRecommendation["action"]) {
  return {
    remove: "Remove from routine",
    replace: "Replace one product",
    add: "Add one product",
    keep: "Keep one product",
    no_change: "Keep routine stable"
  }[action];
}

function ExperimentAiTools({
  id,
  onApplyRecommendation
}: {
  id: string;
  onApplyRecommendation?(recommendation: RoutineRecommendation): void;
}) {
  const { apiFetch, authStatus } = useAppState();
  const [recommendation, setRecommendation] = useState<RoutineRecommendation | null>(null);
  const [simulation, setSimulation] = useState<SkinSimulation | null>(null);
  const [simulationBlobUrl, setSimulationBlobUrl] = useState("");
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [simulationError, setSimulationError] = useState("");

  useEffect(() => {
    let active = true;
    void apiFetch(`/api/v1/experiments/${encodeURIComponent(id)}/recommendation`, {
        cache: "no-store"
      })
      .then((response) => readApiResponse<RoutineRecommendation | null>(response))
      .then((loadedRecommendation) => {
        if (active) setRecommendation(loadedRecommendation);
      })
      .catch(() => {
        // A saved recommendation is optional; generation remains available.
      });
    return () => {
      active = false;
    };
  }, [apiFetch, id]);

  useEffect(() => {
    if (simulation?.status !== "queued" && simulation?.status !== "processing") return;
    const timer = window.setTimeout(() => {
      void apiFetch(`/api/v1/experiments/${encodeURIComponent(id)}/simulation`, {
        cache: "no-store"
      })
        .then((response) => readApiResponse<SkinSimulation | null>(response))
        .then((updated) => {
          setSimulation(updated);
          if (updated?.status === "failed") {
            setSimulationError(updated.error?.message ?? "The illustration could not be generated.");
          }
        })
        .catch((pollError: unknown) => {
          setSimulationError(
            pollError instanceof Error ? pollError.message : "Simulation status is unavailable."
          );
        });
    }, simulation.pollAfterMs ?? 2000);
    return () => window.clearTimeout(timer);
  }, [apiFetch, id, simulation]);

  useEffect(() => {
    if (
      simulation?.status !== "succeeded" ||
      !simulation.imageUrl ||
      simulation.imageUrl.startsWith("/images/")
    ) return;
    let active = true;
    let objectUrl = "";
    void apiFetch(simulation.imageUrl, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The generated image could not be loaded.");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSimulationBlobUrl(objectUrl);
      })
      .catch((imageError: unknown) => {
        if (active) {
          setSimulationError(
            imageError instanceof Error ? imageError.message : "The generated image is unavailable."
          );
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiFetch, simulation]);

  async function generateRecommendation() {
    setRecommendationBusy(true);
    setRecommendationError("");
    try {
      const response = await apiFetch(
        `/api/v1/experiments/${encodeURIComponent(id)}/recommendation`,
        { method: "POST" }
      );
      const generated = await readApiResponse<RoutineRecommendation>(response);
      setRecommendation(generated);
      onApplyRecommendation?.(generated);
    } catch (error) {
      setRecommendationError(
        error instanceof Error ? error.message : "The routine suggestion could not be generated."
      );
    } finally {
      setRecommendationBusy(false);
    }
  }

  async function generateSimulation() {
    const regenerate = simulation?.status === "succeeded";
    setSimulationBusy(true);
    setSimulationError("");
    setSimulation(null);
    setSimulationBlobUrl("");
    try {
      if (regenerate) {
        const deleted = await apiFetch(
          `/api/v1/experiments/${encodeURIComponent(id)}/simulation`,
          { method: "DELETE" }
        );
        await readApiResponse(deleted);
      }
      const response = await apiFetch(
        `/api/v1/experiments/${encodeURIComponent(id)}/simulation`,
        { method: "POST" }
      );
      const started = await readApiResponse<SkinSimulation>(response);
      setSimulation(started);
      if (started.status === "failed") {
        setSimulationError(started.error?.message ?? "The illustration could not be generated.");
      }
    } catch (error) {
      setSimulationError(
        error instanceof Error ? error.message : "The illustration could not be generated."
      );
    } finally {
      setSimulationBusy(false);
    }
  }

  async function deleteSimulation() {
    setSimulationBusy(true);
    setSimulationError("");
    try {
      const response = await apiFetch(
        `/api/v1/experiments/${encodeURIComponent(id)}/simulation`,
        { method: "DELETE" }
      );
      await readApiResponse(response);
      setSimulation(null);
      setSimulationBlobUrl("");
    } catch (error) {
      setSimulationError(
        error instanceof Error ? error.message : "The generated image could not be deleted."
      );
    } finally {
      setSimulationBusy(false);
    }
  }

  const simulationImage =
    simulation?.status === "succeeded" && simulation.imageUrl?.startsWith("/images/")
      ? simulation.imageUrl
      : simulationBlobUrl;

  return (
    <section className="experiment-ai-panel experiment-ai-panel--embedded">
      <div className="panel-header">
        <div>
          <p className="eyebrow"><Sparkles size={13} /> AI experiment studio</p>
          <h2>Use prior evidence to plan this one change</h2>
          <p>
            OpenAI may suggest an addition, removal, or replacement. The YouCam result illustrates
            the recorded experiment outcome and expires after 24 hours.
          </p>
        </div>
      </div>
      <div className="experiment-ai-grid">
        <article className="ai-tool-card">
          <div className="ai-tool-heading">
            <div>
              <span className="status-pill">OpenAI</span>
              <h3>Routine suggestion</h3>
            </div>
            <ListRestart size={22} />
          </div>
          {recommendation ? (
            <>
              <p className="eyebrow">{recommendationActionLabel(recommendation.action)}</p>
              <p><strong>{recommendation.summary}</strong></p>
              {recommendation.existingProductName ? (
                <p className="muted">Current product: {recommendation.existingProductName}</p>
              ) : null}
              {recommendation.candidateProduct ? (
                <div className="candidate-product">
                  <small>Suggested candidate</small>
                  <strong>
                    {recommendation.candidateProduct.brand}{" "}
                    {recommendation.candidateProduct.name}
                  </strong>
                  <span>{recommendation.candidateProduct.category}</span>
                  {recommendation.candidateProduct.productUrl ? (
                    <a
                      href={recommendation.candidateProduct.productUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Verify product source
                    </a>
                  ) : null}
                </div>
              ) : null}
              <ul className="compact-list">
                {recommendation.rationale.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {recommendation.sources.length > 0 ? (
                <div className="recommendation-sources">
                  <small>Web sources</small>
                  {recommendation.sources.map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ))}
                </div>
              ) : null}
              <p className="callout compact">{recommendation.uncertainty}</p>
              <p className="fine-print">{recommendation.disclaimer}</p>
            </>
          ) : (
            <p className="muted">
              Generate one add, remove, replace, or keep suggestion using experiment evidence and
              current web product information.
            </p>
          )}
          {recommendationError ? (
            <p className="callout danger" role="alert">{recommendationError}</p>
          ) : null}
          <button
            type="button"
            className="button button-secondary"
            disabled={recommendationBusy}
            onClick={() => void generateRecommendation()}
          >
            <Sparkles size={17} />
            {recommendationBusy
              ? "Applying AI suggestion..."
              : "AI routine suggestion"}
          </button>
        </article>

        <article className="ai-tool-card">
          <div className="ai-tool-heading">
            <div>
              <span className="status-pill">YouCam simulation</span>
              <h3>Illustrative improvement from recorded change</h3>
            </div>
            <ScanFace size={22} />
          </div>
          {simulationImage ? (
            <div className="simulation-result">
              <NextImage
                src={simulationImage}
                alt="AI-generated illustrative skin appearance based on recorded cosmetic measurements"
                width={640}
                height={640}
                unoptimized
              />
              <span className="simulation-label">AI-generated illustration</span>
            </div>
          ) : simulation?.status === "queued" || simulation?.status === "processing" ? (
            <div className="simulation-loading" role="status">
              <span className="spinner" />
              <p>YouCam is generating the illustration...</p>
            </div>
          ) : (
            <p className="muted">
              Uses the retained baseline image and latest follow-up measurements. It does not
              predict what a product will do.
            </p>
          )}
          {simulation?.expiresAt && simulation.status === "succeeded" ? (
            <p className="fine-print">
              Private image expires {new Date(simulation.expiresAt).toLocaleString()}.
            </p>
          ) : null}
          {simulationError ? (
            <p className="callout danger" role="alert">{simulationError}</p>
          ) : null}
          <p className="fine-print">
            {simulation?.disclaimer ??
              "The generated appearance is an illustration, not a diagnosis, forecast, or guarantee."}
          </p>
          {authStatus === "guest" || authStatus === "demo" ? (
            <p className="fine-print">
              Demo mode uploads the same synthetic face shown on the Scan page. Signed-in
              simulations use the retained baseline from the selected experiment.
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={
                simulationBusy ||
                simulation?.status === "queued" ||
                simulation?.status === "processing"
              }
              onClick={() => void generateSimulation()}
            >
              <Sparkles size={17} />
              {simulationBusy
                ? "Starting..."
                : simulation?.status === "succeeded"
                  ? "Regenerate illustration"
                  : "Generate illustration"}
            </button>
            {simulation?.status === "succeeded" ? (
              <button
                type="button"
                className="button button-quiet"
                disabled={simulationBusy}
                onClick={() => void deleteSimulation()}
              >
                <Trash2 size={17} /> Delete
              </button>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function AuthenticatedExperimentDetail({ id }: { id: string }) {
  const { apiFetch } = useAppState();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiFetch(
      `/api/v1/experiments/${encodeURIComponent(id)}`,
      { cache: "no-store" }
    ).then((response) => readApiResponse<Experiment>(response)).then((data) => {
      if (active) setExperiment(data);
    }).catch((loadError: unknown) => {
      if (active) {
        setError(loadError instanceof Error ? loadError.message : "The experiment could not be loaded.");
      }
    });
    return () => {
      active = false;
    };
  }, [apiFetch, id]);

  if (error) {
    return (
      <main className="page-shell" id="main">
        <div className="callout danger" role="alert">{error}</div>
      </main>
    );
  }
  if (!experiment) {
    return (
      <main className="page-shell" id="main">
        <section className="panel"><p>Loading experiment...</p></section>
      </main>
    );
  }

  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">{experiment.name}</h1>
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Recorded timeline</h2>
                <p>Authenticated check-ins and attached normalized scans remain available across devices.</p>
              </div>
              <span className="status-pill">{experiment.checkIns.length} check-ins</span>
            </div>
            <div className="timeline">
              <TimelineItem
                date={new Date(experiment.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                title="Experiment started"
                detail={`${experiment.suspectProductName} selected for one planned routine change.`}
                tag="Plan"
              />
              {experiment.checkIns.map((item, index) => (
                <TimelineItem
                  key={item.id}
                  date={new Date(item.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  title={`Check-in ${index + 1}`}
                  detail={
                    item.confounders.length > 0
                      ? item.confounders.join(", ")
                      : `${item.adherence}% adherence · observation ${item.observation}/10`
                  }
                  tag={item.scanId ? "Scan" : "Observation"}
                />
              ))}
              {experiment.checkIns.length === 0 ? (
                <p className="muted">No check-ins yet. Add the first observation when the planned interval is complete.</p>
              ) : null}
            </div>
          </section>
        </div>
        <aside>
          <section className="panel next-action">
            <p className="eyebrow"><FlaskConical size={13} /> Experiment rule</p>
            <h2>One planned change</h2>
            <div className="routine-lock">
              <div className="lock-row">
                <div><strong>{experiment.suspectProductName}</strong><small>{capitalize(experiment.type)}</small></div>
                <Pause size={17} />
              </div>
            </div>
            <Link className="button" href="/check-in" style={{ marginTop: 16 }}>
              <Plus size={18} /> New check-in
            </Link>
          </section>
          {experiment.result ? (
            <section className="panel">
              <p className="eyebrow">Current evidence</p>
              <h3>{capitalize(experiment.result.associationLevel)} association</h3>
              <p className="muted">{experiment.result.wording}</p>
              <p><strong>Visible trend:</strong> {experiment.result.components.imageTrend}/100</p>
              <p><strong>Measurements:</strong> {experiment.result.usedConcerns.join(", ")}</p>
              <Link className="button button-secondary" href={`/results/${experiment.id}`}>
                View explainable result <ArrowRight size={18} />
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

export function ResultsPage({ id = experimentId }: { id?: string }) {
  const { apiFetch, authStatus } = useAppState();
  const [loadedExperiment, setLoadedExperiment] = useState<Experiment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let active = true;
    void apiFetch(`/api/v1/experiments/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((response) => readApiResponse<Experiment>(response))
      .then((loaded) => {
        if (active) setLoadedExperiment(loaded);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "The result could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [apiFetch, authStatus, id]);

  const experiment = authStatus === "authenticated" ? loadedExperiment : seededExperiment;
  if (error) {
    return <main className="page-shell" id="main"><div className="callout danger" role="alert">{error}</div></main>;
  }
  if (!experiment) {
    return <main className="page-shell" id="main"><section className="panel"><p>Loading result...</p></section></main>;
  }
  const result = experiment.result ?? insufficientResult;
  const currentExperiment = experiment;

  function exportJson() {
    const blob = new Blob([JSON.stringify({
      experiment: { ...currentExperiment, result },
      disclaimer: persistentDisclaimer
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `skincause-${currentExperiment.id}-result.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading eyebrow="Experiment result" title="What the available evidence shows" description="A measured summary with every contribution and limitation kept visible." />
      <section className="result-hero">
        <div>
          <p className="eyebrow">{experiment.name}</p>
          <div className="result-label">{capitalize(result.associationLevel)} association</div>
          <p>{result.wording}</p>
          <p className="muted">This score ranks evidence strength inside this experiment. It is not the probability that a product produced a condition.</p>
        </div>
        <ScoreDisc score={result.score ?? 0} label="of 100" />
      </section>

      <div className="evidence-grid" aria-label="Evidence components">
        <EvidenceItem label="Visible trend" value={result.components.imageTrend} note="35% weight" />
        <EvidenceItem label="Self-report" value={result.components.selfReportTrend} note="25% weight" />
        <EvidenceItem label="Adherence" value={result.components.adherence} note="20% weight" />
        <EvidenceItem label="Repeatability" value={result.components.repeatability} note="20% weight" />
        <EvidenceItem label="Confounders" value={`−${result.components.confounderPenalty}`} note="Sun exposure" />
        <EvidenceItem label="Scan quality" value={`−${result.components.qualityPenalty}`} note="One warning" />
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <details className="disclosure" open>
          <summary>Why this result?</summary>
          <div className="disclosure-body">
            <p>Comparable measurements were evaluated against the locked baseline in the expected direction for this {experiment.type} experiment.</p>
            <p><strong>Measurements used:</strong> {result.usedConcerns.join(", ")}.</p>
          </div>
        </details>
        <details className="disclosure">
          <summary>What limits this result?</summary>
          <div className="disclosure-body">
            <ul>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </details>
        <details className="disclosure">
          <summary>What can I do next?</summary>
          <div className="disclosure-body">
            <p>You can end here, export this summary, or explicitly start a reintroduction experiment. SkinCause does not auto-start reintroduction.</p>
          </div>
        </details>
      </section>

      <div className="row-actions" style={{ marginTop: 24 }}>
        <Link
          className="button"
          href={`/experiments/new?from=${encodeURIComponent(experiment.id)}`}
        >
          <ListRestart size={18} /> Plan reintroduction
        </Link>
        <button className="button button-secondary" onClick={exportJson}><FileJson size={18} /> Export JSON</button>
        <button className="button button-secondary" onClick={() => window.print()}><Printer size={18} /> Print summary</button>
      </div>
      <div className="callout" style={{ marginTop: 24 }}><strong>Cosmetic tracking boundary</strong><p className="muted">{persistentDisclaimer}</p></div>
    </main>
  );
}

export function PrivacyPage() {
  const router = useRouter();
  const {
    apiFetch,
    authStatus,
    retainImages,
    setRetainImages,
    deletedImageIds,
    deleteImage,
    reset,
    signOut
  } = useAppState();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const retainedScans = scans.slice(0, 3);

  async function deleteWorkspace() {
    setDeleteError("");
    try {
      if (authStatus === "authenticated") {
        await readApiResponse(await apiFetch("/api/v1/account", { method: "DELETE" }));
        await signOut().catch(() => undefined);
      }
      reset();
      window.localStorage.removeItem("skincause-active-scan");
      window.localStorage.removeItem("skincause-latest-scan");
      window.localStorage.removeItem("skincause-active-experiment");
      router.push("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "The workspace could not be deleted.");
    }
  }

  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Privacy</h1>
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="privacy-row">
              <div><h2>Original image retention</h2><p className="muted">When off, originals are removed after normalized measurements are ready.</p></div>
              <button type="button" role="switch" className="toggle" aria-label="Retain original images" aria-checked={retainImages} onClick={() => setRetainImages(!retainImages)} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-header"><div><h2>Original scan images</h2><p>Synthetic records for the demo workspace.</p></div><span className="status-pill">{retainedScans.length - deletedImageIds.length} retained</span></div>
            <div className="image-list">
              {retainedScans.map((scan, index) => {
                const deleted = deletedImageIds.includes(scan.id);
                return (
                  <article className="image-record" key={scan.id}>
                    <div className="image-placeholder">{deleted ? <ImageOff size={32} /> : <ScanFace size={32} />}</div>
                    <strong>{index === 0 ? "Baseline" : `Follow-up ${index}`}</strong>
                    <p className="muted">{new Date(scan.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    {deleted ? (
                      <span className="status-pill"><Check size={13} /> Original deleted</span>
                    ) : (
                      <button className="button button-danger button-small" onClick={() => deleteImage(scan.id)}><Trash2 size={16} /> Delete image</button>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="muted" style={{ marginTop: 14 }}>Normalized scores remain available in the experiment timeline after image deletion.</p>
          </section>
        </div>
        <aside>
          <section className="panel">
            <p className="eyebrow">Portable copy</p>
            <h2>Export investigation</h2>
            <p>Download the seeded routine, check-ins, measurements, result, and limitations as JSON.</p>
            <Link className="button button-secondary" href={`/api/v1/experiments/${experimentId}/export`}><Download size={18} /> Open export</Link>
          </section>
          <section className="panel">
            <p className="eyebrow">Full deletion</p>
            <h2>Delete this workspace</h2>
            <p>Remove the local consent, routine changes, scan references, check-ins, and privacy settings.</p>
            {!confirmDelete ? (
              <button className="button button-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete workspace</button>
            ) : (
              <div className="callout danger">
                <strong>This cannot be undone.</strong>
                {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button className="button button-danger button-small" onClick={() => void deleteWorkspace()}><Check size={16} /> Confirm</button>
                  <button className="button button-secondary button-small" onClick={() => setConfirmDelete(false)}><XCircle size={16} /> Cancel</button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function ScoreDisc({ score, label }: { score: number; label: string }) {
  return <div className="score-disc" aria-label={`${score} ${label}`}><strong>{score}</strong><span>{label}</span></div>;
}

function TimelineItem({ date, title, detail, tag }: { date: string; title: string; detail: string; tag: string }) {
  return (
    <div className="timeline-item">
      <span className="timeline-dot" />
      <span className="timeline-date">{date}</span>
      <div className="timeline-content"><strong>{title}</strong><p>{detail}</p></div>
      <span className={tag === "Confounder" ? "status-pill warning" : "status-pill"}>{tag}</span>
    </div>
  );
}

function EvidenceItem({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <article className="evidence-item"><span className="muted">{label}</span><strong>{value}</strong><span className="status-pill">{note}</span></article>;
}

function Toast({ text }: { text: string }) {
  return <div className="toast" role="status"><CheckCircle2 size={17} style={{ verticalAlign: "middle", marginRight: 8 }} />{text}</div>;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
