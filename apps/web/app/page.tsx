import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Camera,
  CircleDot,
  FlaskConical,
  LockKeyhole,
  ScanLine,
  ShieldCheck
} from "lucide-react";

const heroMetrics = [
  { icon: FlaskConical, value: "1", label: "planned routine change" },
  { icon: ScanLine, value: "3+", label: "repeat measurements" },
  { icon: ShieldCheck, value: "Off", label: "image retention default" }
];

const processSteps = [
  {
    number: "01",
    title: "Capture the baseline",
    detail: "Start with a repeatable, evenly lit reference before changing the routine."
  },
  {
    number: "02",
    title: "Change one product",
    detail: "Pause or reintroduce one selected product while every other step stays visible."
  },
  {
    number: "03",
    title: "Read the pattern",
    detail: "Compare measurements, observations, adherence, and confounders without hiding uncertainty."
  }
];

export default function HomePage() {
  return (
    <main className="landing" id="main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <h1 id="landing-title">Understand what changed.</h1>
            <p className="landing-offer">One product. Repeatable scans. Evidence with limits.</p>
            <p className="landing-summary">
              Track whether one routine change moves with what you see and feel, using repeatable scans
              and evidence that keeps its limits visible.
            </p>
            <div className="landing-actions">
              <Link className="button landing-primary-action" href="/demo">
                Analyze skin <ArrowRight size={18} />
              </Link>
              <Link className="landing-text-link" href="/auth">
                Sign in <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="landing-face-stage" aria-label="Example standardized facial scan">
            <Image
              className="landing-face-image"
              src="/images/landing-model.png"
              alt="Fictional adult in a three-quarter pose for a standardized cosmetic scan"
              fill
              priority
              sizes="(max-width: 760px) 92vw, 48vw"
            />
            <div className="scan-crosshair horizontal" aria-hidden="true" />
            <div className="scan-crosshair vertical" aria-hidden="true" />
            <div className="scan-marker scan-marker-redness">
              <span>Redness</span>
              <strong>43</strong>
            </div>
            <div className="scan-marker scan-marker-pores">
              <span>Pores</span>
              <strong>39</strong>
            </div>
            <p className="landing-image-note">Fictional demo image</p>
          </div>

          <div className="landing-metrics" aria-label="Experiment principles">
            {heroMetrics.map(({ icon: Icon, value, label }) => (
              <div className="landing-metric" key={label}>
                <Icon size={20} aria-hidden="true" />
                <div><strong>{value}</strong><span>{label}</span></div>
              </div>
            ))}
          </div>
        </div>

        <a className="landing-scroll-cue" href="#method">
          See the method <ArrowDown size={16} />
        </a>
      </section>

      <div className="landing-intro-strip" aria-hidden="true">
        <span>Baseline</span><CircleDot size={14} /><span>One change</span><CircleDot size={14} /><span>Repeated evidence</span>
      </div>

      <section className="landing-method" id="method" aria-labelledby="method-title">
        <div className="landing-method-visual">
          <Image
            src="/images/routine-editorial.png"
            alt="Fictional adult applying moisturizer during a consistent skincare routine"
            fill
            sizes="(max-width: 920px) 100vw, 50vw"
          />
          <span className="visual-label visual-label-baseline"><Camera size={14} /> Baseline recorded</span>
          <span className="visual-label visual-label-routine"><LockKeyhole size={14} /> Routine held constant</span>
        </div>

        <div className="landing-method-copy">
          <div>
            <p className="landing-kicker">A controlled routine experiment</p>
            <h2 id="method-title">Measure what changes. Keep what does not.</h2>
            <p>
              SkinCause places each scan inside a timeline. Product history, self-reports, adherence,
              and unusual events remain beside the measurements that they may influence.
            </p>
          </div>
          <div className="landing-process">
            {processSteps.map((step) => (
              <article className="landing-process-step" key={step.number}>
                <span>{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.detail}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-statement" aria-labelledby="statement-title">
        <span className="statement-tag tag-measured">Measured</span>
        <span className="statement-tag tag-private">Private</span>
        <span className="statement-tag tag-repeatable">Repeatable</span>
        <span className="statement-tag tag-honest">Uncertainty visible</span>
        <p className="landing-kicker">Clarity without overclaiming</p>
        <h2 id="statement-title">
          See the pattern.<br />
          <span>Keep uncertainty visible.</span><br />
          Make one decision at a time.
        </h2>
        <p>
          SkinCause organizes cosmetic observations. It does not diagnose a condition, prescribe
          treatment, or claim that association proves causation.
        </p>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <div>
          <p className="landing-kicker">Your image. Your timeline. Your control.</p>
          <h2 id="final-title">Try the complete scan flow with a prepared fictional face.</h2>
        </div>
        <Link className="button" href="/demo">Open the demo <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
