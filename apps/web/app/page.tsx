import { ArrowRight, Camera, FlaskConical, LockKeyhole, ScanLine, ShieldCheck, Sparkles, TrendingDown } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={14} /> A calmer way to investigate change</p>
            <h1 id="hero-title">SkinCause</h1>
            <p>
              Understand whether a recent routine change tracks with what you see and feel.
              One product, repeatable scans, and evidence that shows its limits.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/consent">
                Start a guided investigation <ArrowRight size={18} />
              </Link>
              <Link className="button button-secondary" href="/dashboard?demo=1">
                View seeded demo
              </Link>
            </div>
            <div className="hero-metric">
              <ShieldCheck size={18} />
              Original images are deleted by default after measurement.
            </div>
          </div>
        </div>
      </section>

      <section className="section-band" aria-labelledby="how-title">
        <div className="section-inner">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A controlled routine experiment</p>
              <h2 id="how-title">Change one thing. Measure what follows.</h2>
            </div>
            <p>
              SkinCause turns a confusing routine change into a structured timeline,
              pairing repeatable cosmetic measurements with your own observations.
            </p>
          </div>
          <div className="steps">
            <article className="step">
              <span className="step-number">01</span>
              <Camera size={28} aria-hidden="true" />
              <h3>Establish a baseline</h3>
              <p>Record your routine and capture an evenly lit reference scan before making a change.</p>
            </article>
            <article className="step">
              <span className="step-number">02</span>
              <FlaskConical size={28} aria-hidden="true" />
              <h3>Lock the routine</h3>
              <p>Pause or reintroduce one selected product while keeping every other step consistent.</p>
            </article>
            <article className="step">
              <span className="step-number">03</span>
              <TrendingDown size={28} aria-hidden="true" />
              <h3>Read the evidence</h3>
              <p>Compare scan trends, adherence, self-reports, and confounders with visible uncertainty.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section-band alt" aria-labelledby="trust-title">
        <div className="section-inner promise-grid">
          <div>
            <p className="eyebrow">Built for trust</p>
            <h2 id="trust-title">A routine debugger, not another product recommender.</h2>
            <div className="promise-list">
              <div className="promise-item">
                <span className="promise-icon"><ScanLine size={20} /></span>
                <div>
                  <h3>Repeated measurements</h3>
                  <p>YouCam-compatible scan orchestration makes the image a measurement inside a timeline, not a one-off verdict.</p>
                </div>
              </div>
              <div className="promise-item">
                <span className="promise-icon"><LockKeyhole size={20} /></span>
                <div>
                  <h3>Private by default</h3>
                  <p>Retain normalized scores while deleting the original image, or remove everything from one privacy center.</p>
                </div>
              </div>
              <div className="promise-item">
                <span className="promise-icon"><ShieldCheck size={20} /></span>
                <div>
                  <h3>Uncertainty stays visible</h3>
                  <p>Every result names the measurements used, confidence penalties, and reasons the evidence may be limited.</p>
                </div>
              </div>
            </div>
          </div>
          <aside className="evidence-preview" aria-label="Example evidence result">
            <p className="eyebrow">Seeded investigation</p>
            <div className="preview-score">79</div>
            <h3>Strong association</h3>
            <p className="muted">Repeated observations tracked the product change. This remains an association, not proof of causation.</p>
            <div className="preview-bars">
              <PreviewBar label="Visible trend" value={86} />
              <PreviewBar label="Self-report trend" value={78} />
              <PreviewBar label="Protocol adherence" value={100} />
              <PreviewBar label="Repeatability" value={94} />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function PreviewBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-row">
      <div className="metric-label"><span>{label}</span><span>{value}</span></div>
      <div className="bar" aria-label={`${label}: ${value} out of 100`}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
