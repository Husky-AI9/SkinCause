"use client";

import { seededExperiment, scans, persistentDisclaimer } from "@skincause/domain";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CloudSun,
  Download,
  Droplets,
  Eye,
  FileJson,
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
  Sun,
  Trash2,
  Upload,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAppState } from "./app-provider";

const experimentId = "brightening-serum-elimination";

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
                <p className="muted">Off by default. Derived scores can still be used in your timeline.</p>
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
  const { products, addProduct } = useAppState();
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    addProduct({
      name: String(data.get("name")),
      brand: String(data.get("brand")),
      category: String(data.get("category")),
      startedAt: new Date(String(data.get("startedAt"))).toISOString(),
      cadence: "daily",
      timeOfDay: String(data.get("timeOfDay")) as "AM" | "PM" | "AM + PM",
      active: true,
      recentlyChanged: data.get("recentlyChanged") === "on"
    });
    event.currentTarget.reset();
    setSaved(true);
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
      {saved && <Toast text="Product added to this guest workspace." />}
    </main>
  );
}

export function DashboardPage() {
  const { products, checkInSaved } = useAppState();
  const result = seededExperiment.result;
  return (
    <main className="page-shell" id="main">
      <PageHeading
        eyebrow="Seeded investigation"
        title="Good morning, investigator."
        description="Your serum elimination is complete. The visible trend and your observations moved in the same direction."
        action={<Link className="button" href="/check-in"><Plus size={18} /> New check-in</Link>}
      />
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
      <PageHeading
        eyebrow="Routine inventory"
        title="Products and usage history"
        description="Stopping and restarting a product appends to its timeline; it does not erase prior usage."
        action={<Link className="button" href="/onboarding"><Plus size={18} /> Add product</Link>}
      />
      <section className="panel">
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "ready" | "uploading" | "processing" | "done">("idle");

  useEffect(() => {
    const activeId = window.localStorage.getItem("skincause-active-scan");
    if (activeId && status === "idle") {
      const timer = window.setTimeout(() => setStatus("ready"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [status]);

  function chooseFile(file?: File) {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Upload a JPG or PNG image.");
      return;
    }
    if (file.size >= 10_000_000) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    setFileName(file.name);
    setStatus("ready");
  }

  function submitScan() {
    const scanId = window.localStorage.getItem("skincause-active-scan") ?? crypto.randomUUID();
    window.localStorage.setItem("skincause-active-scan", scanId);
    setStatus("uploading");
    window.setTimeout(() => setStatus("processing"), 700);
    window.setTimeout(() => {
      setStatus("done");
      window.localStorage.removeItem("skincause-active-scan");
    }, 2200);
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading
        eyebrow="Guided baseline scan"
        title="Make each scan comparable"
        description="Use the same position, expression, and lighting each time. The provider remains the final quality validator."
      />
      <div className="scan-grid">
        <section className="capture-zone">
          <div>
            <div className="face-guide" aria-hidden="true"><Focus size={50} /></div>
            <p style={{ marginTop: 18, marginBottom: 4 }}><strong>Center your face inside the guide</strong></p>
            <p className="muted">Front-facing · neutral expression · eyes open</p>
          </div>
        </section>
        <aside className="scan-instructions">
          <section className="panel">
            <div className="panel-header"><div><h2>Capture checklist</h2><p>Repeat this setup at every check-in.</p></div><Camera size={24} /></div>
            <Instruction icon={Sun} title="Even front lighting">Avoid strong backlight and direct shadows.</Instruction>
            <Instruction icon={Eye} title="Unobstructed face">Remove glasses and move hair away from the face.</Instruction>
            <Instruction icon={Focus} title="Consistent framing">Keep the full face visible and close enough for analysis.</Instruction>
          </section>
          <section className="panel">
            <input
              className="upload-input"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={(event) => chooseFile(event.target.files?.[0])}
              aria-label="Choose a JPG or PNG image"
            />
            {error && <div className="callout danger" role="alert" style={{ marginTop: 14 }}>{error}</div>}
            {(fileName || status === "ready") && !error && (
              <div className="quality-box" style={{ marginTop: 14 }}>
                <strong>{fileName || "Resumable scan found"}</strong>
                <p className="muted">Basic format and size checks passed. Final framing is checked after upload.</p>
              </div>
            )}
            {status === "idle" && (
              <button className="button" style={{ width: "100%", marginTop: 16 }} onClick={() => fileRef.current?.click()}>
                <Upload size={18} /> Choose image
              </button>
            )}
            {status === "ready" && (
              <button className="button" style={{ width: "100%", marginTop: 16 }} onClick={submitScan}>
                <ScanFace size={18} /> Analyze in mock mode
              </button>
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
                <div className="quality-box"><strong>Scan complete</strong><p className="muted">Redness 43 · Texture 44 · Pores 39</p></div>
                <button className="button" style={{ width: "100%", marginTop: 16 }} onClick={() => router.push("/experiments/new")}>
                  Plan experiment <ArrowRight size={18} />
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function Instruction({ icon: Icon, title, children }: { icon: typeof Sun; title: string; children: React.ReactNode }) {
  return <div className="instruction"><Icon size={23} /><div><strong>{title}</strong><p className="muted">{children}</p></div></div>;
}

export function ExperimentPlannerPage() {
  const router = useRouter();
  const { products } = useAppState();
  const [type, setType] = useState<"elimination" | "reintroduction">("elimination");
  return (
    <main className="page-shell" id="main">
      <PageHeading eyebrow="Step 4 of 4" title="Plan one clear change" description="Select one suspect product. Every other routine step becomes a locked snapshot for the duration of the investigation." />
      <form className="dashboard-grid" onSubmit={(event) => { event.preventDefault(); router.push(`/experiments/${experimentId}`); }}>
        <section className="panel">
          <div className="form-grid">
            <div className="field full">
              <span className="field-label">Experiment type</span>
              <div className="segmented" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <button type="button" className={type === "elimination" ? "is-active" : ""} onClick={() => setType("elimination")}>Elimination</button>
                <button type="button" className={type === "reintroduction" ? "is-active" : ""} onClick={() => setType("reintroduction")}>Reintroduction</button>
              </div>
            </div>
            <div className="field full">
              <label htmlFor="suspect">Suspect product</label>
              <select id="suspect" defaultValue="brightening-serum">
                {products.map((product) => <option value={product.id} key={product.id}>{product.name}{product.recentlyChanged ? " · recently changed" : ""}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="start-date">Start date</label>
              <input id="start-date" type="date" defaultValue="2026-07-24" />
            </div>
            <div className="field">
              <label htmlFor="primary-concern">Primary concern</label>
              <select id="primary-concern"><option>Redness</option><option>Texture</option><option>Pores</option></select>
            </div>
            <div className="field full">
              <label htmlFor="hypothesis">What are you trying to observe?</label>
              <textarea id="hypothesis" defaultValue="Observe whether redness and texture change while the serum is paused." />
            </div>
          </div>
        </section>
        <aside>
          <section className="panel next-action">
            <p className="eyebrow"><LockKeyhole size={13} /> Single-variable policy</p>
            <h2>Everything else stays consistent</h2>
            <p>SkinCause will mark a check-in as confounded if another routine step changes during this experiment.</p>
            <button className="button" type="submit">Start investigation <ArrowRight size={18} /></button>
          </section>
        </aside>
      </form>
    </main>
  );
}

export function CheckInPage() {
  const router = useRouter();
  const { saveCheckIn } = useAppState();
  const [adherence, setAdherence] = useState("all");
  const [observation, setObservation] = useState(5);
  const [confounders, setConfounders] = useState<string[]>([]);
  const [concerning, setConcerning] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleConfounder = (value: string) =>
    setConfounders((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (concerning) return;
    saveCheckIn();
    setSaved(true);
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading
        eyebrow="Day 15 check-in"
        title="Record what happened, not what you hoped."
        description="A short structured check-in makes the final evidence more interpretable."
        action={<Link className="button button-secondary" href="/dashboard"><ArrowLeft size={18} /> Dashboard</Link>}
      />
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
              <div className="metric-label"><span>Redness or discomfort</span><strong>{observation}/10</strong></div>
              <input aria-label="Redness or discomfort from 0 to 10" type="range" min="0" max="10" value={observation} onChange={(event) => setObservation(Number(event.target.value))} />
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
              <textarea id="notes" placeholder="Keep this factual and brief." />
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
          <button className="button" type="submit" disabled={concerning} style={{ width: "100%" }}>
            Save check-in <Check size={18} />
          </button>
        </aside>
      </form>
      {saved && (
        <div className="toast" role="status">
          Check-in saved. <button className="button button-small" style={{ marginLeft: 10 }} onClick={() => router.push(`/experiments/${experimentId}`)}>View timeline</button>
        </div>
      )}
    </main>
  );
}

export function ExperimentDetailPage() {
  const { checkInSaved } = useAppState();
  return (
    <main className="page-shell" id="main">
      <PageHeading
        eyebrow="Completed elimination · Jun 9–24"
        title="Brightening serum elimination"
        description="The serum was paused while the cleanser and moisturizer remained locked."
        action={<Link className="button" href={`/results/${experimentId}`}>View result <ArrowRight size={18} /></Link>}
      />
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

export function ResultsPage() {
  const result = seededExperiment.result;

  function exportJson() {
    const blob = new Blob([JSON.stringify({ experiment: seededExperiment, disclaimer: persistentDisclaimer }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "skincause-brightening-serum-result.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading eyebrow="Experiment result" title="What the available evidence shows" description="A measured summary with every contribution and limitation kept visible." />
      <section className="result-hero">
        <div>
          <p className="eyebrow">Brightening serum elimination</p>
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
            <p>The normalized redness and texture measurements decreased across a majority of valid follow-ups. Your observations moved in the same direction and adherence was complete.</p>
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
        <Link className="button" href="/experiments/new"><ListRestart size={18} /> Plan reintroduction</Link>
        <button className="button button-secondary" onClick={exportJson}><FileJson size={18} /> Export JSON</button>
        <button className="button button-secondary" onClick={() => window.print()}><Printer size={18} /> Print summary</button>
      </div>
      <div className="callout" style={{ marginTop: 24 }}><strong>Cosmetic tracking boundary</strong><p className="muted">{persistentDisclaimer}</p></div>
    </main>
  );
}

export function PrivacyPage() {
  const router = useRouter();
  const { retainImages, setRetainImages, deletedImageIds, deleteImage, reset } = useAppState();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const retainedScans = scans.slice(0, 3);

  function deleteWorkspace() {
    reset();
    window.localStorage.removeItem("skincause-active-scan");
    router.push("/");
  }

  return (
    <main className="page-shell" id="main">
      <PageHeading eyebrow="Privacy center" title="Your data, visible and removable" description="Original images and derived scores are separate controls. Removing an image does not erase the measurements unless you choose full deletion." />
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="privacy-row">
              <div><h2>Original image retention</h2><p className="muted">When off, originals are removed after normalized measurements are ready.</p></div>
              <button type="button" role="switch" className="toggle" aria-label="Retain original images" aria-checked={retainImages} onClick={() => setRetainImages(!retainImages)} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-header"><div><h2>Original scan images</h2><p>Synthetic records for the seeded demo.</p></div><span className="status-pill">{retainedScans.length - deletedImageIds.length} retained</span></div>
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
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button className="button button-danger button-small" onClick={deleteWorkspace}><Check size={16} /> Confirm</button>
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
