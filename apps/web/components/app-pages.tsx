"use client";

import {
  AI_ACNE_PATTERN_CONCERN_KEY,
  AI_ACNE_SEVERITY_CONCERN_KEY,
  type Experiment,
  type RoutineRecommendation,
  type Scan,
  type ScanActivityEvent,
  type ScanUploadSession,
  type SkinSimulation
} from "@skincause/contracts";
import {
  classifyCosmeticConcern,
  compareScanConcerns,
  getVisibleAcnePatternAssessment,
  insufficientResult,
  seededExperiment,
  scans,
  persistentDisclaimer,
  roundVisibleSeverity,
  summarizeScanReadiness
} from "@skincause/domain";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  CloudSun,
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
  Waves
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
const plannedAiExperimentStorageKey = "skincause-planned-ai-experiment";
const latestScanResultStorageKey = "skincause-latest-scan-result";

const dailyNutritionTargets = [
  {
    food: "Mixed berries",
    amount: "1 cup",
    serving: "Fresh or frozen, unsweetened"
  },
  {
    food: "Fresh vegetables",
    amount: "2 cups",
    serving: "Across meals; use a mix of colors"
  },
  {
    food: "Beans or lentils",
    amount: "1/2 cup",
    serving: "Cooked, unsweetened serving"
  },
  {
    food: "Steel-cut oats",
    amount: "1/2 cup",
    serving: "Cooked; choose an unsweetened bowl"
  },
  {
    food: "Water",
    amount: "6–8 cups",
    serving: "About 1.5–2 L; adjust for heat and activity"
  }
] as const;

type PlannedAiExperiment = {
  actionLabel: string;
  budgetUsd?: number;
  productName: string | null;
  productMeta: string | null;
  productUrl: string | null;
  nutritionObservation: string | null;
  measurementKeys?: string[];
  hypothesis: string;
};

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
    ["blemish_pattern", 0],
    [AI_ACNE_SEVERITY_CONCERN_KEY, 1],
    ["redness", 2],
    ["texture", 3],
    ["pores", 4],
    ["oiliness", 5],
    ["hydration", 6],
    ["radiance", 7],
    [AI_ACNE_PATTERN_CONCERN_KEY, 8]
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
  if (concernKey === "blemish_pattern" || concernKey === AI_ACNE_SEVERITY_CONCERN_KEY) {
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
                Delete your account data at any time from the Acne plan.
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

export function LegacyDashboardPage() {
  const router = useRouter();
  const {
    apiFetch,
    authStatus,
    checkInSaved,
    demoMode,
    exitDemo,
    products,
    reset,
    signOut
  } = useAppState();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const result = seededExperiment.result;

  async function deleteUserData() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      if (demoMode) {
        await exitDemo({ requireRemoteDeletion: true });
      } else {
        if (authStatus === "authenticated") {
          await readApiResponse(await apiFetch("/api/v1/account", { method: "DELETE" }));
          await signOut().catch(() => undefined);
        }
        reset();
        window.localStorage.removeItem("skincause-active-scan");
        window.localStorage.removeItem("skincause-latest-scan");
        window.localStorage.removeItem("skincause-active-experiment");
      }
      router.replace("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Your data could not be deleted.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Dashboard</h1>
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Acne-focused progress</p>
                <h2>Visible acne-pattern trend</h2>
                <p>YouCam-compatible baseline compared with three standardized follow-ups.</p>
              </div>
              <span className="status-pill success"><CheckCircle2 size={14} /> Completed</span>
            </div>
            <div className="trend-layout">
              <ScoreDisc score={result.score ?? 0} label="evidence score" />
              <div>
                <div className="trend-chart" role="img" aria-label="Visible acne-pattern severity decreased from 60 at baseline to 38 at follow-up three">
                  {[60, 52, 43, 38].map((value, index) => (
                    <div className="trend-column" key={value}>
                      <div className="trend-bar" style={{ height: `${value}%` }} title={`${value}`} />
                      <span>{index === 0 ? "Baseline" : `Day ${index * 5}`}</span>
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 36 }}>Visible acne-pattern severity decreased 22 points across the available demo scans.</p>
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
            <h2>Review the affordable AI plan</h2>
            <p>See the suggested product action, nutrition context, and YouCam illustration beside the experiment evidence.</p>
            <Link className="button" href={`/experiments/new?from=${experimentId}`}>Open acne plan <ArrowRight size={18} /></Link>
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
              <div><h3>Nutrition context</h3><p>Tracked, never assumed</p></div>
              <CircleDot size={22} />
            </div>
            <p className="muted">Keep meals broadly consistent and record major changes beside each scan. Food relationships vary and do not prove the cause of a visible acne pattern.</p>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h3>Analysis provider</h3><p>Deterministic demo mode</p></div>
              <ScanFace size={22} />
            </div>
            <span className="status-pill success">YouCam-compatible mock</span>
            <p className="muted" style={{ marginTop: 12 }}>Upload → task → poll → normalized concern scores. No API units used in demo mode.</p>
          </section>
          <section className="panel">
            <p className="eyebrow">Data control</p>
            <h3>Delete your data</h3>
            <p className="muted">Permanently remove your routine, scans, experiments, check-ins, and account data.</p>
            {!confirmDelete ? (
              <button
                className="button button-danger"
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
              >
                <Trash2 size={18} /> Delete my data
              </button>
            ) : (
              <div className="callout danger">
                <strong>This cannot be undone.</strong>
                <p>Confirm that you want to permanently delete all of your SkinCause data.</p>
                {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button
                    className="button button-danger button-small"
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => void deleteUserData()}
                  >
                    <Trash2 size={16} /> {deleteBusy ? "Deleting..." : "Permanently delete"}
                  </button>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export function DashboardPage() {
  const router = useRouter();
  const {
    apiFetch,
    authStatus,
    checkInSaved,
    demoMode,
    exitDemo,
    products,
    reset,
    signOut
  } = useAppState();
  const [latestScan, setLatestScan] = useState<Scan | null>(null);
  const [latestExperiment, setLatestExperiment] = useState<Experiment | null>(null);
  const [plannedExperiment, setPlannedExperiment] = useState<PlannedAiExperiment | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (authStatus === "loading") return;
    let active = true;

    async function loadPlanSummary() {
      await Promise.resolve();
      if (!active) return;

      let storedScan: Scan | null = null;
      const storedScanValue = window.localStorage.getItem(latestScanResultStorageKey);
      if (storedScanValue) {
        try {
          const parsed = JSON.parse(storedScanValue) as Partial<Scan>;
          if (typeof parsed.id === "string" && Array.isArray(parsed.concerns)) {
            storedScan = parsed as Scan;
          }
        } catch {
          window.localStorage.removeItem(latestScanResultStorageKey);
        }
      }

      let storedPlan: PlannedAiExperiment | null = null;
      const storedPlanValue = window.localStorage.getItem(plannedAiExperimentStorageKey);
      if (storedPlanValue) {
        try {
          const parsed = JSON.parse(storedPlanValue) as Partial<PlannedAiExperiment>;
          if (typeof parsed.actionLabel === "string" && typeof parsed.hypothesis === "string") {
            storedPlan = {
              actionLabel: parsed.actionLabel,
              budgetUsd:
                typeof parsed.budgetUsd === "number" && Number.isFinite(parsed.budgetUsd)
                  ? parsed.budgetUsd
                  : undefined,
              productName: typeof parsed.productName === "string" ? parsed.productName : null,
              productMeta: typeof parsed.productMeta === "string" ? parsed.productMeta : null,
              productUrl: typeof parsed.productUrl === "string" ? parsed.productUrl : null,
              nutritionObservation:
                typeof parsed.nutritionObservation === "string"
                  ? parsed.nutritionObservation
                  : null,
              measurementKeys: Array.isArray(parsed.measurementKeys)
                ? parsed.measurementKeys.filter((key): key is string => typeof key === "string")
                : undefined,
              hypothesis: parsed.hypothesis
            };
          }
        } catch {
          window.localStorage.removeItem(plannedAiExperimentStorageKey);
        }
      }

      try {
        let experiment: Experiment | null = null;
        if (authStatus === "authenticated") {
          const experiments = await readApiResponse<Experiment[]>(
            await apiFetch("/api/v1/experiments", { cache: "no-store" })
          );
          experiment =
            experiments.find((item) => item.status === "active") ??
            experiments[0] ??
            null;

          if (!storedScan) {
            const scanId =
              window.localStorage.getItem("skincause-latest-scan") ??
              experiment?.baselineScanId ??
              null;
            if (scanId) {
              const scanStatus = await readApiResponse<ScanStatusResponse>(
                await apiFetch(`/api/v1/scans/${encodeURIComponent(scanId)}`, {
                  cache: "no-store"
                })
              );
              storedScan = scanStatus.result ?? null;
            }
          }
        }

        if (!active) return;
        setLatestScan(storedScan);
        setLatestExperiment(experiment);
        setPlannedExperiment(storedPlan);
      } catch (error) {
        if (!active) return;
        setLatestScan(storedScan);
        setPlannedExperiment(storedPlan);
        setSummaryError(
          error instanceof Error ? error.message : "Your latest plan could not be loaded."
        );
      } finally {
        if (active) setSummaryLoading(false);
      }
    }

    void loadPlanSummary();
    return () => {
      active = false;
    };
  }, [apiFetch, authStatus]);

  async function deleteUserData() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      if (demoMode) {
        await exitDemo({ requireRemoteDeletion: true });
      } else {
        if (authStatus === "authenticated") {
          await readApiResponse(await apiFetch("/api/v1/account", { method: "DELETE" }));
          await signOut().catch(() => undefined);
        }
        reset();
        window.localStorage.removeItem("skincause-active-scan");
        window.localStorage.removeItem("skincause-latest-scan");
        window.localStorage.removeItem("skincause-active-experiment");
      }
      window.localStorage.removeItem(latestScanResultStorageKey);
      window.localStorage.removeItem(plannedAiExperimentStorageKey);
      router.replace("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Your data could not be deleted.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const displayedScan = latestScan ?? (demoMode ? scans[0] : null);
  const scanReadiness = displayedScan ? summarizeScanReadiness(displayedScan) : null;
  const displayedConcerns = displayedScan
    ? orderedConcerns(displayedScan)
        .filter((concern) => concern.normalizedSeverity !== null)
        .slice(0, 5)
    : [];
  const acneAssessment = displayedScan
    ? getVisibleAcnePatternAssessment(displayedScan)
    : null;
  const demoExperiment = demoMode ? seededExperiment : null;
  const selectedProductId =
    latestExperiment?.suspectProductId ?? demoExperiment?.suspectProductId;
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const experimentProductName =
    plannedExperiment?.productName ??
    latestExperiment?.suspectProductName ??
    selectedProduct?.name ??
    "No product selected";
  const experimentType = latestExperiment?.type ?? demoExperiment?.type;
  const experimentAction =
    plannedExperiment?.actionLabel ??
    (experimentType
      ? experimentType === "elimination"
        ? "Suspend one product"
        : "Introduce one product"
      : "No experiment planned");
  const fullHypothesis =
    plannedExperiment?.hypothesis ??
    latestExperiment?.hypothesis ??
    demoExperiment?.hypothesis ??
    "Start an experiment to connect one routine change with repeatable scan measurements.";
  const nutritionMarker = "Nutrition context to track:";
  const experimentHypothesis = fullHypothesis.split(`\n\n${nutritionMarker}`)[0];
  const nutritionObservation =
    plannedExperiment?.nutritionObservation ??
    (fullHypothesis.includes(nutritionMarker)
      ? fullHypothesis.split(nutritionMarker).at(-1)?.trim() ?? null
      : null);
  const primaryConcernKeys =
    latestExperiment?.primaryConcerns ??
    plannedExperiment?.measurementKeys ??
    (demoMode
      ? [AI_ACNE_SEVERITY_CONCERN_KEY, "blemish_pattern", "redness"]
      : displayedConcerns.slice(0, 3).map((concern) => concern.key));
  const experimentDetailId = latestExperiment?.id ?? (demoMode ? experimentId : null);
  const experimentStatus =
    latestExperiment?.status ?? demoExperiment?.status ?? (plannedExperiment ? "planned" : null);
  const activeProductCount = products.filter((product) => product.active).length;
  const checkInCount =
    (latestExperiment?.checkIns.length ?? demoExperiment?.checkIns.length ?? 0) +
    (checkInSaved ? 1 : 0);

  return (
    <main className="page-shell acne-plan-page" id="main">
      <section className="acne-plan-hero">
        <div>
          <p className="eyebrow">Your SkinCause workspace</p>
          <h1>Acne plan</h1>
          <p>Your latest scan, one-variable experiment, routine, and daily nutrition targets in one place.</p>
          <div className="acne-plan-actions">
            <Link className="button button-secondary" href="/scan/new">
              <ScanFace size={18} /> New scan
            </Link>
            <Link className="button" href="/experiments/new">
              Plan experiment <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {summaryError ? <div className="callout danger" role="alert">{summaryError}</div> : null}

      <section className="acne-plan-overview" aria-label="Acne plan overview">
        <article className="acne-plan-stat">
          <span>Acne severity</span>
          <strong>{summaryLoading ? "…" : acneAssessment?.severity?.normalizedSeverity ?? "—"}</strong>
          <small>
            {displayedScan
              ? classifyCosmeticConcern(acneAssessment?.severity?.normalizedSeverity ?? null).label
              : "Complete a scan to begin"}
          </small>
        </article>
        <article className="acne-plan-stat">
          <span>Experiment change</span>
          <strong className="is-text">{experimentAction}</strong>
          <small>{experimentProductName}</small>
        </article>
        <article className="acne-plan-stat">
          <span>Current routine</span>
          <strong>{activeProductCount}</strong>
          <small>
            {activeProductCount === 1 ? "active product" : "active products"} · {checkInCount} check-ins
          </small>
        </article>
      </section>

      <div className="acne-plan-content-grid">
        <section className="panel acne-plan-scan-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Latest scan</p>
              <h2>Visible skin measurements</h2>
              <p>
                {displayedScan
                  ? `Captured ${new Date(displayedScan.capturedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}`
                  : "No completed scan is available yet."}
              </p>
            </div>
            <Link className="button button-quiet button-small" href="/scan/new">
              View scan <ArrowRight size={16} />
            </Link>
          </div>
          {acneAssessment?.severity || acneAssessment?.visiblePattern ? (
            <div className="acne-ai-assessment" aria-label="AI visible acne-pattern assessment">
              <div>
                <span>Acne severity score</span>
                <strong>
                  {acneAssessment.severity?.normalizedSeverity ?? "—"}<small>/100</small>
                </strong>
              </div>
              <div>
                <span>Observed acne pattern</span>
                <strong>{acneAssessment.visiblePattern ?? "Unclassified visible acne pattern"}</strong>
              </div>
              <p>OpenAI organizes the normalized YouCam measurements. This is a cosmetic pattern description, not an acne diagnosis.</p>
            </div>
          ) : null}
          {scanReadiness ? (
            <div className="scan-readiness acne-plan-readiness">
              <div>
                <span>Capture readiness</span>
                <strong>{scanReadiness.score}/100 · {scanReadiness.label}</strong>
              </div>
              {scanReadiness.note ? <p>{scanReadiness.note}</p> : null}
            </div>
          ) : null}
          {displayedConcerns.length > 0 ? (
            <div className="acne-concern-list">
              {displayedConcerns.map((concern) => {
                const severity = roundVisibleSeverity(concern.normalizedSeverity) ?? 0;
                const classification = classifyCosmeticConcern(concern.normalizedSeverity);
                return (
                  <article className="acne-concern-row" key={concern.key}>
                    <div>
                      <strong>{concern.displayLabel ?? concern.providerLabel}</strong>
                      <small>{classification.label}</small>
                    </div>
                    <div className="acne-concern-meter" aria-label={`${severity} out of 100`}>
                      <span style={{ width: `${severity}%` }} />
                    </div>
                    <strong>{severity}</strong>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="acne-plan-empty">
              <ScanFace size={30} />
              <strong>Add your baseline scan</strong>
              <p>Skin measurements from the Scan page will appear here automatically.</p>
            </div>
          )}
        </section>

        <div className="acne-plan-side-stack">
          <section className="panel acne-plan-experiment-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Experiment</p>
                <h2>One planned change</h2>
              </div>
              {experimentStatus ? (
                <span className="status-pill success">
                  <Check size={13} /> {capitalize(experimentStatus)}
                </span>
              ) : null}
            </div>
            <div className="acne-plan-change">
              <span>{experimentAction}</span>
              <strong>{experimentProductName}</strong>
              {plannedExperiment?.productMeta ? <small>{plannedExperiment.productMeta}</small> : null}
              {plannedExperiment?.budgetUsd ? <small>Product budget: ${plannedExperiment.budgetUsd.toFixed(0)}</small> : null}
            </div>
            <div className="acne-plan-hypothesis">
              <small>What you are measuring</small>
              <p>{experimentHypothesis}</p>
            </div>
            {primaryConcernKeys.length > 0 ? (
              <div className="acne-plan-tags">
                {primaryConcernKeys.map((key) => (
                  <span key={key}>{capitalize(key.replaceAll("_", " "))}</span>
                ))}
              </div>
            ) : null}
            <Link
              className="button button-secondary button-small"
              href={experimentDetailId ? `/experiments/${experimentDetailId}` : "/experiments/new"}
            >
              {experimentDetailId ? "Open experiment" : "Create experiment"} <ArrowRight size={16} />
            </Link>
          </section>

          <section className="panel acne-plan-routine-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Routine</p>
                <h2>Products in this plan</h2>
              </div>
              <Link className="button button-quiet button-small" href="/products">Edit</Link>
            </div>
            <div className="routine-lock">
              {products.map((product) => (
                <div className="lock-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.timeOfDay} · {product.cadence}</small>
                  </div>
                  <span className={product.active ? "status-pill success" : "status-pill warning"}>
                    {product.active ? "Active" : "Paused"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="panel acne-nutrition-plan">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Daily nutrition plan</p>
            <h2>Simple food and hydration targets</h2>
            <p>Use these as a separate nutrition observation; keep them stable while a product experiment runs.</p>
          </div>
          <span className="status-pill"><CircleDot size={13} /> Daily</span>
        </div>
        {nutritionObservation ? (
          <div className="acne-nutrition-focus">
            <strong>Experiment nutrition focus</strong>
            <p>{nutritionObservation}</p>
          </div>
        ) : null}
        <div className="acne-nutrition-grid">
          {dailyNutritionTargets.map((target) => (
            <article key={target.food}>
              <span>{target.amount}</span>
              <strong>{target.food}</strong>
              <small>{target.serving}</small>
            </article>
          ))}
        </div>
        <p className="fine-print">
          These are general food-serving targets, not acne treatment or individualized nutrition advice.
          Adjust for allergies, medical needs, climate, and guidance from a qualified professional.
        </p>
      </section>

      <details className="panel acne-plan-data-controls">
        <summary>Data controls</summary>
        <div>
          <h3>Delete your data</h3>
          <p className="muted">Permanently remove your routine, scans, experiments, check-ins, and account data.</p>
          {!confirmDelete ? (
            <button
              className="button button-danger"
              type="button"
              onClick={() => {
                setDeleteError("");
                setConfirmDelete(true);
              }}
            >
              <Trash2 size={18} /> Delete my data
            </button>
          ) : (
            <div className="callout danger">
              <strong>This cannot be undone.</strong>
              <p>Confirm that you want to permanently delete all of your SkinCause data.</p>
              {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
              <div className="row-actions" style={{ marginTop: 12 }}>
                <button
                  className="button button-danger button-small"
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void deleteUserData()}
                >
                  <Trash2 size={16} /> {deleteBusy ? "Deleting..." : "Permanently delete"}
                </button>
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </details>
    </main>
  );
}

export function ProductsPage() {
  const { products, toggleProduct } = useAppState();
  return (
    <main className="page-shell products-page" id="main">
      <PageHeading
        eyebrow="Affordable routine"
        title="Products in your acne plan"
        description="Keep the routine visible, change one product at a time, and carry every selection into your next experiment."
        action={<Link className="button" href="/onboarding"><Plus size={18} /> Add product</Link>}
      />
      <section className="products-workspace">
        <div className="products-workspace-heading">
          <div>
            <p className="eyebrow">Current routine</p>
            <h2>{products.length} products recorded</h2>
          </div>
          <span className="status-pill"><ShieldCheck size={13} /> One-change ready</span>
        </div>
        <div className="product-card-grid">
          {products.map((product) => (
            <article className={`routine-product-card${product.active ? "" : " is-paused"}`} key={product.id}>
              <span className="product-swatch"><Droplets size={21} /></span>
              <div>
                <strong>{product.name}</strong>
                <small>{product.brand || "Unbranded"} · {product.category} · started {new Date(product.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
              </div>
              <span className={product.active ? "status-pill success" : "status-pill warning"}>
                {product.active ? "Active" : "Paused"}
              </span>
              <button className="button button-secondary button-small" onClick={() => toggleProduct(product.id)}>
                {product.active ? <Pause size={16} /> : <Check size={16} />}
                {product.active ? "Pause product" : "Return to routine"}
              </button>
            </article>
          ))}
        </div>
      </section>
      <div className="products-trust-strip">
        <ShieldCheck size={20} />
        <div>
          <strong>Your routine remains the control.</strong>
          <span>Product changes are recorded as usage periods so each experiment keeps a comparable history.</span>
        </div>
        <Link href="/experiments/new">Plan one change <ArrowRight size={16} /></Link>
      </div>
    </main>
  );
}

export function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiFetch, demoMode, enterDemo, retainImages } = useAppState();
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
    if (searchParams.get("demo") !== "true") return;
    let active = true;
    void enterDemo()
      .catch(() => undefined)
      .finally(() => {
        if (active) router.replace("/scan/new");
      });
    return () => {
      active = false;
    };
  }, [enterDemo, router, searchParams]);

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
        window.localStorage.setItem(latestScanResultStorageKey, JSON.stringify(resumedResult));
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
      const blob = await fetch("/images/demo-face-acne.png")
      .then((response) => {
        if (!response.ok) throw new Error("The demo image could not be loaded.");
        return response.blob();
      });
      const file = new File([blob], "skincause-acne-demo.png", { type: "image/png" });
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
      if (usingDemoImage) {
        setStatus("processing");
        setActivity((current) => mergeActivity(current, [
          localActivity("client", "analyzing bundled demo image")
        ]));
        const demoScan = await readApiResponse<ScanStatusResponse>(
          await apiFetch("/api/v1/scans/demo", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ clientRequestId })
          })
        );
        if (!demoScan.result) {
          throw new Error(demoScan.error?.message ?? "The demo image could not be analyzed.");
        }
        setActivity((current) => mergeActivity(current, demoScan.activity ?? []));
        setResult(demoScan.result);
        setActiveConcern(initialConcernKey(demoScan.result));
        setStatus("done");
        window.localStorage.setItem(latestScanResultStorageKey, JSON.stringify(demoScan.result));
        window.localStorage.setItem("skincause-latest-scan", demoScan.scanId);
        window.localStorage.removeItem("skincause-active-scan");
        return;
      }
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
      window.localStorage.setItem(latestScanResultStorageKey, JSON.stringify(completed));
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

  function resetScan() {
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
  }

  return (
    <main className="page-shell" id="main">
      <h1 className="sr-only">Scan</h1>
      <div className="scan-grid">
        <ScanResultsSidebar status={status} result={result} onPlanExperiment={() => router.push("/experiments/new")} />
        <div className="scan-image-column">
          <section className={previewUrl ? "capture-zone has-image" : "capture-zone"}>
            {previewUrl && status === "done" && result ? (
              <ConcernImage
                scan={result}
                imageUrl={previewUrl}
                activeConcern={activeConcern}
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
        </div>
        <aside className="scan-instructions">
          <AnalysisActivity status={status} activity={activity} />
          <section className={`panel scan-action-panel scan-action-panel-${status}`}>
            <input
              className="upload-input"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
              aria-label="Choose a JPG or PNG image"
            />
            {status === "idle" ? <YouCamCameraKit onCapture={acceptCameraKitCapture} /> : null}
            {error && <div className="callout danger" role="alert" style={{ marginTop: 14 }}>{error}</div>}
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
              <button className="button button-secondary scan-again-button" type="button" onClick={resetScan}>
                <ScanFace size={18} /> Analyze another image
              </button>
            )}
            {status === "failed" && (
              <button className="button button-secondary" style={{ width: "100%", marginTop: 16 }} onClick={resetScan}>
                Try another image
              </button>
            )}
          </section>
        </aside>
        <section className="panel segmentation-panel">
          <div className="segmentation-heading">
            <strong>Facial segmentation</strong>
            {result ? (
              <span>{orderedConcerns(result).filter((concern) => concern.maskUrl).length} provider mask overlays</span>
            ) : null}
          </div>
          {status === "done" && result ? (
            <SegmentationControls
              scan={result}
              activeConcern={activeConcern}
              onSelectConcern={setActiveConcern}
            />
          ) : (
            <p className="segmentation-placeholder">Overlay controls appear here after analysis.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function AnalysisActivity({
  status,
  activity
}: {
  status: ScanWorkflowStatus;
  activity: ScanActivityEvent[];
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const isRunning = status === "uploading" || status === "processing";

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [activity]);

  return (
    <section className="panel analysis-activity-panel">
      <div className="panel-header">
        <h2>Live execution log</h2>
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
    </section>
  );
}

function ScanResultsSidebar({
  status,
  result,
  onPlanExperiment
}: {
  status: ScanWorkflowStatus;
  result: Scan | null;
  onPlanExperiment: () => void;
}) {
  const readiness = result ? summarizeScanReadiness(result) : null;
  return (
    <aside className="panel scan-results-sidebar" aria-label="Scan results">
      <div className="scan-results-header">
        <h2>Scan results</h2>
        {status === "done" && result ? (
          <span className={`result-provenance result-provenance-${result.provider}`}>
            {result.provider === "youcam"
              ? `Live YouCam ${result.providerVersion ?? "provider"}`
              : "Agent test result"}
          </span>
        ) : null}
      </div>
      <div className="scan-results-scroll">
        {status === "done" && result ? (
          <div className="scan-score-list" data-testid="provider-score-summary">
            {readiness ? (
              <div className="scan-readiness" aria-label={`Capture readiness ${readiness.score} out of 100`}>
                <div>
                  <span>Capture readiness</span>
                  <strong>{readiness.score}/100</strong>
                </div>
                <p>{readiness.label}{readiness.note ? `. ${readiness.note}` : ""}</p>
              </div>
            ) : null}
            {orderedConcerns(result).map((concern) => {
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
            })}
          </div>
        ) : (
          <p className="scan-results-placeholder">
            {status === "uploading" || status === "processing"
              ? "Analyzing image…"
              : "Scores appear here after analysis."}
          </p>
        )}
      </div>
      <button
        className="button scan-results-action"
        type="button"
        onClick={onPlanExperiment}
      >
        Plan experiment <ArrowRight size={18} />
      </button>
    </aside>
  );
}

function ConcernImage({
  scan,
  imageUrl,
  activeConcern
}: {
  scan: Scan;
  imageUrl: string;
  activeConcern: string | null;
}) {
  const active = scan.concerns.find((concern) => concern.key === activeConcern);
  const overlayUrl = active?.maskUrl;

  return (
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
  );
}

function SegmentationControls({
  scan,
  activeConcern,
  onSelectConcern
}: {
  scan: Scan;
  activeConcern: string | null;
  onSelectConcern: (key: string | null) => void;
}) {
  const availableConcerns = orderedConcerns(scan).filter((concern) => concern.maskUrl);

  if (availableConcerns.length === 0) {
    return (
      <div className="concern-unavailable" role="status">
        <ImageOff size={18} />
        <span>Location data was not returned for this scan. Scores remain available.</span>
      </div>
    );
  }

  return (
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
  const [baselineImageUrl, setBaselineImageUrl] = useState(
    authStatus === "authenticated" ? "" : "/images/demo-face-acne.png"
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [budgetUsd, setBudgetUsd] = useState(25);
  const [selectedMeasurements, setSelectedMeasurements] = useState<string[] | null>(null);
  const [hypothesis, setHypothesis] = useState(
    "Observe whether the selected visible patterns change while this one routine step is adjusted."
  );
  const [includeNutritionObservation, setIncludeNutritionObservation] = useState(false);
  const [nutritionObservation, setNutritionObservation] = useState("");
  const [appliedRecommendation, setAppliedRecommendation] =
    useState<RoutineRecommendation | null>(null);
  const stagedCandidateIdRef = useRef<string | null>(null);
  const evidenceExperimentId =
    searchParams.get("from") ?? (authStatus === "authenticated" ? null : experimentId);
  const availableConcerns = orderedConcerns(baseline ?? scans[0])
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

  useEffect(() => {
    if (authStatus !== "authenticated") {
      const timer = window.setTimeout(() => setBaselineImageUrl("/images/demo-face-acne.png"), 0);
      return () => window.clearTimeout(timer);
    }
    if (!baseline) return;
    let active = true;
    let objectUrl = "";
    void apiFetch(`/api/v1/scans/${encodeURIComponent(baseline.id)}/image`, {
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.blob();
      })
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setBaselineImageUrl(objectUrl);
      })
      .catch(() => {
        // The original may already be deleted by the user's retention setting.
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiFetch, authStatus, baseline]);

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
    setNutritionObservation(
      `Keep meals broadly consistent. Queue for a later food experiment: ${recommendation.nutritionGuidance.foodsToConsider.join(", ")}. ${recommendation.nutritionGuidance.trackingPrompt}`
    );
    setIncludeNutritionObservation(false);
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
    const data = new FormData(event.currentTarget);
    const primaryConcerns = data.getAll("primaryConcerns").map(String);
    const selectedNutritionObservation = includeNutritionObservation
      ? nutritionObservation.trim()
      : "";
    const submittedHypothesis = selectedNutritionObservation
      ? `${hypothesis.trim()}\n\nNutrition context to track: ${selectedNutritionObservation}`
      : hypothesis.trim();

    const candidate = appliedRecommendation?.candidateProduct;
      const plannedAiExperiment: PlannedAiExperiment = {
        actionLabel: appliedRecommendation
          ? recommendationActionLabel(appliedRecommendation.action)
          : type === "elimination"
            ? "Suspend product"
            : "Add or replace product",
        budgetUsd,
        productName: candidate
          ? `${candidate.brand} ${candidate.name}`
          : products.find((product) => product.id === effectiveProductId)?.name ?? null,
        productMeta: candidate
          ? [candidate.category, candidate.estimatedPrice, candidate.localAvailability]
              .filter(Boolean)
              .join(" · ") || null
          : null,
        productUrl: candidate?.productUrl ?? null,
        nutritionObservation: selectedNutritionObservation || null,
        measurementKeys: primaryConcerns,
        hypothesis: submittedHypothesis
      };
      window.localStorage.setItem(
        plannedAiExperimentStorageKey,
        JSON.stringify(plannedAiExperiment)
      );
    if (authStatus !== "authenticated") {
      router.push(`/experiments/${experimentId}`);
      return;
    }
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
            hypothesis: submittedHypothesis,
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
    <main className="page-shell experiment-planner-page" id="main">
      <PageHeading
        title="Plan one clear change"
        description="Select one suspect product. Every other routine step becomes a locked snapshot for the duration of the investigation."
        action={
          <Link className="button button-secondary" href="/scan/new">
            <ArrowLeft size={18} /> Back to scan
          </Link>
        }
      />
      <form className="experiment-planner-form" onSubmit={submit}>
        <div className="planner-stack">
          <section className="panel planner-workspace-panel">
            <section className="planner-zone planner-zone--experiment">
              <div className="planner-zone-heading">
                <span>01</span>
                <div>
                  <p className="eyebrow">Your experiment</p>
                  <h2>Choose the one change to test</h2>
                </div>
              </div>
              <div className="form-grid planner-fields">
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
                    AI {appliedRecommendation.action === "add" ? "addition" : "replacement"} · {appliedRecommendation.candidateProduct.brand}{" "}
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
            <div className="field">
              <label htmlFor="product-budget">Maximum product budget</label>
              <div className="budget-input">
                <span aria-hidden="true">$</span>
                <input
                  id="product-budget"
                  name="maxUnitPriceUsd"
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={budgetUsd}
                  onChange={(event) => setBudgetUsd(Number(event.target.value))}
                  required
                />
                <small>USD</small>
              </div>
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
            {appliedRecommendation ? (
              <details className="field full ai-applied-plan">
                <summary className="ai-applied-plan-header">
                  <div>
                    <p className="eyebrow"><CheckCircle2 size={13} /> Applied to this experiment</p>
                    <strong>
                      {appliedRecommendation.candidateProduct
                        ? `${appliedRecommendation.candidateProduct.brand} ${appliedRecommendation.candidateProduct.name}`
                        : recommendationActionLabel(appliedRecommendation.action)}
                    </strong>
                  </div>
                  <span className="status-pill success">Applied</span>
                </summary>
                <div className="ai-applied-plan-grid">
                  <article className="ai-plan-input">
                    <small>Routine change</small>
                    <strong>{recommendationActionLabel(appliedRecommendation.action)}</strong>
                    {appliedRecommendation.existingProductName ? (
                      <span>Current: {appliedRecommendation.existingProductName}</span>
                    ) : null}
                    {appliedRecommendation.candidateProduct ? (
                      <>
                        <span>
                          New: {appliedRecommendation.candidateProduct.brand}{" "}
                          {appliedRecommendation.candidateProduct.name}
                        </span>
                        <span>{appliedRecommendation.candidateProduct.category}</span>
                        {appliedRecommendation.candidateProduct.estimatedPrice ? (
                          <span>{appliedRecommendation.candidateProduct.estimatedPrice}</span>
                        ) : null}
                        {appliedRecommendation.candidateProduct.packageSize ? (
                          <span>
                            {appliedRecommendation.candidateProduct.packageSize}
                            {appliedRecommendation.candidateProduct.pricePerUnit
                              ? ` · ${appliedRecommendation.candidateProduct.pricePerUnit}`
                              : ""}
                          </span>
                        ) : null}
                        {appliedRecommendation.candidateProduct.keyIngredients.length > 0 ? (
                          <span>
                            Label highlights: {appliedRecommendation.candidateProduct.keyIngredients.join(", ")}
                          </span>
                        ) : null}
                        {appliedRecommendation.candidateProduct.localAvailability ? (
                          <span>{appliedRecommendation.candidateProduct.localAvailability}</span>
                        ) : null}
                        {appliedRecommendation.candidateProduct.productUrl ? (
                          <a
                            href={appliedRecommendation.candidateProduct.productUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View product online
                          </a>
                        ) : null}
                      </>
                    ) : null}
                    <small>The product selection and measurement checkboxes above were updated automatically.</small>
                  </article>
                  <article className="ai-plan-input">
                    <label className="check-row ai-nutrition-toggle">
                      <input
                        type="checkbox"
                        checked={includeNutritionObservation}
                        onChange={(event) => setIncludeNutritionObservation(event.target.checked)}
                      />
                      <span>Record nutrition deviations without changing the food plan</span>
                    </label>
                    <textarea
                      aria-label="Nutrition observation to track"
                      name="nutritionTrackingPrompt"
                      value={nutritionObservation}
                      disabled={!includeNutritionObservation}
                      onChange={(event) => setNutritionObservation(event.target.value)}
                    />
                    <div className="food-suggestion-list" aria-label="Foods suggested by AI">
                      {appliedRecommendation.nutritionGuidance.foodsToConsider.map((food) => (
                        <span key={food}>{food}</span>
                      ))}
                    </div>
                    <small>Queue these foods for a separate one-variable experiment; do not add them during this product test.</small>
                    <small>{appliedRecommendation.nutritionGuidance.suggestion}</small>
                    <small>{appliedRecommendation.nutritionGuidance.evidenceNote}</small>
                  </article>
                </div>
              </details>
            ) : null}
            </div>
              <PlannerBaselineCard
                scan={baseline ?? scans[0]}
                imageUrl={baselineImageUrl}
              />
            </section>
            {evidenceExperimentId ? (
              <ExperimentAiTools
                id={evidenceExperimentId}
                baselineScan={baseline ?? scans[0]}
                budgetUsd={budgetUsd}
                onApplyRecommendation={applyRoutineRecommendation}
              />
            ) : (
              <section className="experiment-ai-panel experiment-ai-panel--embedded">
                <div className="ai-studio-empty">
                  <div className="planner-zone-heading ai-studio-heading">
                    <span>02</span>
                    <div>
                      <p className="eyebrow"><Sparkles size={13} /> AI recommendation</p>
                      <h2>Available after your first completed experiment</h2>
                    </div>
                  </div>
                  <p className="muted">
                    OpenAI uses recorded experiment evidence to suggest an addition, removal, or
                    replacement. YouCam needs a retained baseline and comparable follow-up scan to
                    generate the illustrative after-experiment image.
                  </p>
                </div>
              </section>
            )}
            <div className="planner-submit">
              <div className="planner-submit-summary">
                <span className="status-pill success"><CheckCircle2 size={13} /> Ready to start</span>
                <div>
                  <strong>
                    One change. {selectedMeasurementKeys.length} comparable {selectedMeasurementKeys.length === 1 ? "measurement" : "measurements"}.
                  </strong>
                  <span>The remaining routine stays locked throughout the observation.</span>
                </div>
              </div>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <button className="button" type="submit" disabled={busy || products.length === 0}>
                {busy ? "Starting..." : "Start experiment"} <ArrowRight size={18} />
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
  const [plannedAiExperiment, setPlannedAiExperiment] =
    useState<PlannedAiExperiment | null>(null);

  useEffect(() => {
    if (authStatus === "authenticated") return;
    const stored = window.localStorage.getItem(plannedAiExperimentStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<PlannedAiExperiment>;
      if (
        typeof parsed.actionLabel === "string" &&
        typeof parsed.hypothesis === "string"
      ) {
        const nextPlannedExperiment: PlannedAiExperiment = {
          actionLabel: parsed.actionLabel,
          hypothesis: parsed.hypothesis,
          productName: typeof parsed.productName === "string" ? parsed.productName : null,
          productMeta: typeof parsed.productMeta === "string" ? parsed.productMeta : null,
          productUrl: typeof parsed.productUrl === "string" ? parsed.productUrl : null,
          nutritionObservation:
            typeof parsed.nutritionObservation === "string"
              ? parsed.nutritionObservation
              : null,
          measurementKeys: Array.isArray(parsed.measurementKeys)
            ? parsed.measurementKeys.filter((key): key is string => typeof key === "string")
            : undefined
        };
        const timer = window.setTimeout(() => {
          setPlannedAiExperiment(nextPlannedExperiment);
        }, 0);
        return () => window.clearTimeout(timer);
      }
    } catch {
      window.localStorage.removeItem(plannedAiExperimentStorageKey);
    }
  }, [authStatus]);

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
          {plannedAiExperiment ? (
            <section className="panel">
              <p className="eyebrow"><Sparkles size={13} /> Applied AI plan</p>
              <h3>{plannedAiExperiment.actionLabel}</h3>
              {plannedAiExperiment.productName ? (
                <div className="candidate-product">
                  <small>Selected product</small>
                  <strong>{plannedAiExperiment.productName}</strong>
                  {plannedAiExperiment.productMeta ? (
                    <span>{plannedAiExperiment.productMeta}</span>
                  ) : null}
                  {plannedAiExperiment.productUrl ? (
                    <a href={plannedAiExperiment.productUrl} target="_blank" rel="noreferrer">
                      View product online
                    </a>
                  ) : null}
                </div>
              ) : null}
              {plannedAiExperiment.nutritionObservation ? (
                <div className="ai-detail-nutrition">
                  <small>Nutrition context to track</small>
                  <p>{plannedAiExperiment.nutritionObservation}</p>
                </div>
              ) : null}
            </section>
          ) : null}
          <section className="panel">
            <h3>Known limitation</h3>
            <p className="muted">The Jun 18 check-in included unusual sun exposure, reducing confidence by eight points.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ExperimentEvidenceCard({
  baseline,
  recommendation,
  simulation,
  result,
  showDemoImage,
  maxUnitPriceUsd = 25,
  displayImage = true
}: {
  baseline: Scan;
  recommendation: RoutineRecommendation | null;
  simulation: SkinSimulation | null;
  result?: Experiment["result"];
  showDemoImage: boolean;
  maxUnitPriceUsd?: number;
  displayImage?: boolean;
}) {
  const readiness = summarizeScanReadiness(baseline);
  const measurementKeys = recommendation?.measurementKeys.length
    ? recommendation.measurementKeys
    : baseline.concerns
        .filter((concern) => concern.experimentRole === "primary")
        .slice(0, 3)
        .map((concern) => concern.key);
  const changes = result && showDemoImage
    ? compareScanConcerns(scans[0], scans.at(-1)!, measurementKeys)
    : [];
  const candidate = recommendation?.candidateProduct;

  return (
    <section
      className={`experiment-evidence-card${displayImage ? "" : " experiment-evidence-card--without-image"}`}
      aria-label="Experiment evidence card"
    >
      {displayImage ? <div className="experiment-evidence-image">
        {showDemoImage ? (
          <NextImage
            src="/images/demo-face-acne.png"
            alt="Synthetic acne-visible portrait used for this demo scan and simulation"
            width={640}
            height={640}
            priority
          />
        ) : (
          <div className="experiment-evidence-image-placeholder">
            <ScanFace size={34} aria-hidden="true" />
            <span>Private baseline retained for this experiment</span>
          </div>
        )}
        <span className="experiment-evidence-image-label">Same scan source</span>
      </div> : null}
      <div className="experiment-evidence-body">
        <div className="experiment-evidence-heading">
          <div>
            <p className="eyebrow"><FlaskConical size={13} /> Experiment evidence card</p>
            <h3>One change. One comparable baseline.</h3>
          </div>
          <span className={`status-pill ${readiness.score >= 90 ? "success" : ""}`}>
            {readiness.score}/100 capture
          </span>
        </div>
        <div className="experiment-evidence-grid">
          <article>
            <small>Baseline quality</small>
            <strong>{readiness.label}</strong>
            {readiness.note ? <span>{readiness.note}</span> : null}
          </article>
          <article>
            <small>Only planned change</small>
            <strong>{recommendation ? recommendationActionLabel(recommendation.action) : "Awaiting AI suggestion"}</strong>
            <span>
              {candidate
                ? `${candidate.brand} ${candidate.name}`
                : recommendation?.existingProductName ?? "The rest of the routine stays locked"}
            </span>
          </article>
          <article>
            <small>Affordability proof</small>
            <strong>{candidate?.estimatedPrice ?? `$${maxUnitPriceUsd.toFixed(0)} maximum target`}</strong>
            <span>
              {candidate?.pricePerUnit ?? "Price and availability must be source-verified"}
              {candidate?.priceCheckedAt
                ? ` · checked ${new Date(candidate.priceCheckedAt).toLocaleDateString()}`
                : ""}
            </span>
          </article>
          <article>
            <small>Protocol</small>
            <strong>14-day observation</strong>
            <span>Baseline plus at least two comparable follow-ups</span>
          </article>
          <article>
            <small>Locked measurements</small>
            <strong>{measurementKeys.length || 0} signals</strong>
            <span>{measurementKeys.map((key) => key.replaceAll("_", " ")).join(" · ")}</span>
          </article>
          <article>
            <small>YouCam illustration</small>
            <strong>{simulation?.status === "succeeded" ? "Generated" : simulation?.status === "processing" || simulation?.status === "queued" ? "Generating" : "Not generated"}</strong>
            <span>Illustrative goal only—not a product forecast</span>
          </article>
        </div>
        {changes.length > 0 ? (
          <div className="experiment-change-strip" aria-label="Demo score changes from baseline">
            {changes.map((change) => (
              <div key={change.key}>
                <span>{change.key.replaceAll("_", " ")}</span>
                <strong>{change.baseline} → {change.latest}</strong>
                <small>{change.delta > 0 ? "+" : ""}{change.delta} · {change.interpretation}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PlannerBaselineCard({ scan, imageUrl }: { scan: Scan; imageUrl: string }) {
  const readiness = summarizeScanReadiness(scan);
  const acneAssessment = getVisibleAcnePatternAssessment(scan);
  const measurements = orderedConcerns(scan)
    .filter((concern) => concern.experimentRole === "primary")
    .slice(0, 3);

  return (
    <section className="planner-baseline-card" aria-label="Experiment baseline scan">
      <div className="planner-baseline-image">
        {imageUrl ? (
          <NextImage
            src={imageUrl}
            alt="Baseline scan used for this experiment"
            fill
            sizes="(max-width: 640px) 100vw, 166px"
            unoptimized
          />
        ) : (
          <div className="experiment-evidence-image-placeholder">
            <ImageOff size={28} aria-hidden="true" />
            <span>Original deleted; normalized measurements remain available</span>
          </div>
        )}
        <span>Baseline</span>
      </div>
      <div className="planner-baseline-copy">
        <div>
          <p className="eyebrow"><ScanFace size={13} /> Scan used for comparison</p>
          <strong>{readiness.label}</strong>
          <small>{readiness.score}/100 capture readiness</small>
        </div>
        <div className="planner-baseline-measurements">
          {measurements.map((concern) => (
            <div key={concern.key}>
              <span>{concern.displayLabel ?? concern.providerLabel}</span>
              <strong>{concern.normalizedSeverity ?? "—"}</strong>
            </div>
          ))}
        </div>
        <div className="planner-baseline-pattern">
          <span>Observed acne pattern</span>
          <strong>{acneAssessment.visiblePattern ?? "Unclassified visible acne pattern"}</strong>
        </div>
        {readiness.note ? <p>{readiness.note}</p> : null}
      </div>
    </section>
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
  baselineScan,
  budgetUsd,
  onApplyRecommendation
}: {
  id: string;
  baselineScan: Scan;
  budgetUsd: number;
  onApplyRecommendation?(recommendation: RoutineRecommendation): void;
}) {
  const { apiFetch, authStatus } = useAppState();
  const [recommendation, setRecommendation] = useState<RoutineRecommendation | null>(null);
  const [simulation, setSimulation] = useState<SkinSimulation | null>(null);
  const [simulationBlobUrl, setSimulationBlobUrl] = useState("");
  const [simulationSourceBlobUrl, setSimulationSourceBlobUrl] = useState("");
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [simulationError, setSimulationError] = useState("");
  const [activeStudioTab, setActiveStudioTab] = useState<"plan" | "simulation">("plan");

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

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      simulation?.status !== "succeeded" ||
      !simulation.sourceScanId
    ) return;
    let active = true;
    let objectUrl = "";
    void apiFetch(
      `/api/v1/scans/${encodeURIComponent(simulation.sourceScanId)}/image`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("The baseline image could not be loaded.");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSimulationSourceBlobUrl(objectUrl);
      })
      .catch((imageError: unknown) => {
        if (active) {
          setSimulationError(
            imageError instanceof Error ? imageError.message : "The baseline image is unavailable."
          );
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiFetch, authStatus, simulation?.sourceScanId, simulation?.status]);

  async function generateRecommendation() {
    setActiveStudioTab("plan");
    if (!Number.isFinite(budgetUsd) || budgetUsd < 1 || budgetUsd > 500) {
      setRecommendationError("Enter a product budget between $1 and $500.");
      return;
    }
    setRecommendationBusy(true);
    setRecommendationError("");
    try {
      const response = await apiFetch(
        `/api/v1/experiments/${encodeURIComponent(id)}/recommendation`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ maxUnitPriceUsd: budgetUsd })
        }
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
    setActiveStudioTab("simulation");
    const regenerate = simulation?.status === "succeeded";
    setSimulationBusy(true);
    setSimulationError("");
    setSimulation(null);
    setSimulationBlobUrl("");
    setSimulationSourceBlobUrl("");
    setComparisonPosition(50);
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
      setSimulationSourceBlobUrl("");
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
  const simulationSourceImage =
    authStatus === "guest" || authStatus === "demo"
      ? "/images/demo-face-acne.png"
      : simulationSourceBlobUrl;
  const baselineReadiness = summarizeScanReadiness(baselineScan);

  return (
    <section className="experiment-ai-panel experiment-ai-panel--embedded">
      <div className="planner-zone-heading ai-studio-heading">
        <span>02</span>
        <div>
          <p className="eyebrow"><Sparkles size={13} /> AI recommendation</p>
          <h2>Build an affordable next step</h2>
          <p>Generate one sourced routine change, then preview its illustrative YouCam goal.</p>
        </div>
      </div>
      <div className="ai-evidence-strip" aria-label="Experiment evidence summary">
        <div><span>Baseline</span><strong>{baselineReadiness.label}</strong></div>
        <div><span>Planned change</span><strong>{recommendation ? recommendationActionLabel(recommendation.action) : "Awaiting AI"}</strong></div>
        <div><span>Budget</span><strong>${budgetUsd.toFixed(0)} maximum</strong></div>
        <div><span>YouCam goal</span><strong>{simulation?.status === "succeeded" ? "Generated" : "Not generated"}</strong></div>
      </div>
      <details className="experiment-evidence-disclosure">
        <summary>View experiment evidence</summary>
        <ExperimentEvidenceCard
          baseline={baselineScan}
          recommendation={recommendation}
          simulation={simulation}
          result={authStatus === "guest" || authStatus === "demo" ? seededExperiment.result : undefined}
          showDemoImage={authStatus === "guest" || authStatus === "demo"}
          maxUnitPriceUsd={budgetUsd}
          displayImage={false}
        />
      </details>
      <div className="ai-studio-tabs" role="tablist" aria-label="AI experiment studio views">
        <button
          className={activeStudioTab === "plan" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeStudioTab === "plan"}
          aria-controls="ai-plan-panel"
          onClick={() => setActiveStudioTab("plan")}
        >
          <ListRestart size={16} /> 02 Recommendation
        </button>
        <button
          className={activeStudioTab === "simulation" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeStudioTab === "simulation"}
          aria-controls="ai-simulation-panel"
          onClick={() => setActiveStudioTab("simulation")}
        >
          <ScanFace size={16} /> 03 Simulated goal
        </button>
      </div>
      <div className="experiment-ai-grid">
        <article
          className="ai-tool-card"
          id="ai-plan-panel"
          role="tabpanel"
          hidden={activeStudioTab !== "plan"}
        >
          <div className="ai-tool-heading">
            <div>
              <span className="status-pill">OpenAI</span>
              <h3>Affordable product guidance</h3>
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
                <div className="candidate-product candidate-product--featured">
                  {recommendation.candidateProduct.imageUrl ? (
                    <div className="candidate-product-media">
                      {/* AI recommendations may use different verified retailer hosts, so this image cannot use a fixed Next.js remote pattern. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={recommendation.candidateProduct.imageUrl}
                        alt={`${recommendation.candidateProduct.brand} ${recommendation.candidateProduct.name}`}
                        onError={(event) => {
                          event.currentTarget.parentElement?.setAttribute("hidden", "");
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="candidate-product-identity">
                    <span className="product-swatch"><Droplets size={22} /></span>
                    <div>
                      <small>Suggested candidate</small>
                      <strong>
                        {recommendation.candidateProduct.brand}{" "}
                        {recommendation.candidateProduct.name}
                      </strong>
                      <span>{recommendation.candidateProduct.category}</span>
                    </div>
                    {recommendation.candidateProduct.estimatedPrice ? (
                      <div className="candidate-product-price">
                        <small>Verified price</small>
                        <strong>{recommendation.candidateProduct.estimatedPrice}</strong>
                      </div>
                    ) : null}
                  </div>
                  <div className="candidate-product-facts">
                  {recommendation.candidateProduct.estimatedPrice ? (
                    <span><strong>Budget:</strong> target ${budgetUsd.toFixed(0)} or less</span>
                  ) : null}
                  {recommendation.candidateProduct.packageSize ? (
                    <span>
                      <strong>Size:</strong> {recommendation.candidateProduct.packageSize}
                      {recommendation.candidateProduct.pricePerUnit
                        ? ` · ${recommendation.candidateProduct.pricePerUnit}`
                        : ""}
                    </span>
                  ) : null}
                  {recommendation.candidateProduct.priceCheckedAt ? (
                    <span>
                      <strong>Price checked:</strong>{" "}
                      {new Date(recommendation.candidateProduct.priceCheckedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {recommendation.candidateProduct.localAvailability ? (
                    <span><strong>Availability:</strong> {recommendation.candidateProduct.localAvailability}</span>
                  ) : null}
                  </div>
                  {recommendation.candidateProduct.keyIngredients.length > 0 ? (
                    <div className="candidate-ingredient-list" aria-label="Label highlights">
                      {recommendation.candidateProduct.keyIngredients.map((ingredient) => (
                        <span key={ingredient}>{ingredient}</span>
                      ))}
                    </div>
                  ) : null}
                  {recommendation.candidateProduct.usageNote ? (
                    <span><strong>Test protocol:</strong> {recommendation.candidateProduct.usageNote}</span>
                  ) : null}
                  {recommendation.candidateProduct.lowerCostAlternative ? (
                    <span><strong>Lower-cost option:</strong> {recommendation.candidateProduct.lowerCostAlternative}</span>
                  ) : null}
                  {recommendation.candidateProduct.affordabilityNote ? (
                    <span>{recommendation.candidateProduct.affordabilityNote}</span>
                  ) : null}
                  {recommendation.candidateProduct.productUrl ? (
                    <a
                      href={recommendation.candidateProduct.productUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View product online
                    </a>
                  ) : null}
                </div>
              ) : null}
              <div className="ai-nutrition-card">
                <div className="ai-nutrition-card-heading">
                  <div>
                    <p className="eyebrow">Nutrition observation</p>
                    <strong>{recommendation.nutritionGuidance.focus}</strong>
                  </div>
                  <span className="status-pill">Queue separately</span>
                </div>
                <p>{recommendation.nutritionGuidance.suggestion}</p>
                <div className="nutrition-food-grid" aria-label="Foods suggested by AI">
                  {recommendation.nutritionGuidance.foodsToConsider.map((food) => (
                    <span key={food}><Check size={14} /> {food}</span>
                  ))}
                </div>
                <small>{recommendation.nutritionGuidance.trackingPrompt}</small>
              </div>
              <details className="ai-evidence-details">
                <summary>Evidence, sources, and safety</summary>
                <div className="ai-evidence-details-body">
                  <ul className="compact-list">
                    {[...recommendation.rationale, ...recommendation.evidence].map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                  {recommendation.sources.length > 0 ? (
                    <div className="recommendation-sources">
                      <small>Verified sources</small>
                      {recommendation.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <p className="callout compact">{recommendation.uncertainty}</p>
                  <p className="fine-print">{recommendation.disclaimer}</p>
                </div>
              </details>
            </>
          ) : (
            <p className="muted">
              Generate one acne-focused add, remove, replace, or keep suggestion using experiment
              evidence, your ${budgetUsd.toFixed(0)} budget, local availability, and sourced nutrition context.
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

        <article
          className="ai-tool-card"
          id="ai-simulation-panel"
          role="tabpanel"
          hidden={activeStudioTab !== "simulation"}
        >
          <div className="ai-tool-heading">
            <div>
              <span className="status-pill">YouCam simulation</span>
              <h3>Illustrative acne-pattern goal</h3>
            </div>
            <ScanFace size={22} />
          </div>
          {simulationImage && simulationSourceImage ? (
            <>
              <div
                className="simulation-comparison"
                style={{
                  "--comparison-position": `${comparisonPosition}%`
                } as React.CSSProperties}
              >
                <NextImage
                  className="simulation-comparison-image"
                  src={simulationSourceImage}
                  alt="Skin appearance before the illustrative simulation"
                  width={640}
                  height={640}
                  unoptimized
                />
                <div
                  className="simulation-comparison-after"
                  role="img"
                  aria-label="AI-generated illustrative skin appearance based on recorded cosmetic measurements"
                >
                  <NextImage
                    className="simulation-comparison-image"
                    src={simulationImage}
                    alt=""
                    width={640}
                    height={640}
                    unoptimized
                  />
                </div>
                <span className="simulation-comparison-label is-after">After</span>
                <span className="simulation-comparison-label is-before">Before</span>
                <span className="simulation-comparison-divider" aria-hidden="true">
                  <span />
                </span>
                <input
                  className="simulation-comparison-range"
                  type="range"
                  min="0"
                  max="100"
                  value={comparisonPosition}
                  aria-label="Compare skin appearance before and after the illustrative simulation"
                  onChange={(event) => setComparisonPosition(Number(event.target.value))}
                />
              </div>
              <p className="simulation-comparison-help">Drag the slider to compare before and after.</p>
              <p className="fine-print"><strong>AI-generated illustration</strong> · based on the same scan source shown on the left.</p>
            </>
          ) : simulationImage ? (
            <div className="simulation-loading" role="status">
              <span className="spinner" />
              <p>Preparing the before-and-after comparison...</p>
            </div>
          ) : simulation?.status === "queued" || simulation?.status === "processing" ? (
            <div className="simulation-loading" role="status">
              <span className="spinner" />
              <p>YouCam is generating the illustration...</p>
            </div>
          ) : (
            <p className="muted">
              Uses the retained baseline image and selected acne-related measurement changes. It
              does not predict what a product, food, or routine will do.
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

function PageHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h1>{title}</h1><p>{description}</p></div>
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
