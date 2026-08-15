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
  { icon: ScanLine, value: "AI", label: "visible acne-pattern scan" },
  { icon: FlaskConical, value: "≤ $25", label: "demo product budget" },
  { icon: ShieldCheck, value: "1", label: "change tested at a time" }
];

const processSteps = [
  {
    number: "01",
    title: "Measure the acne pattern",
    detail: "YouCam records visible blemish, oiliness, redness, pore, and texture signals from a repeatable scan."
  },
  {
    number: "02",
    title: "Build an affordable plan",
    detail: "OpenAI organizes one budget-aware product action and conservative nutrition context from sourced information."
  },
  {
    number: "03",
    title: "Visualize, then test",
    detail: "YouCam illustrates selected cosmetic changes while follow-up scans test the real pattern over time."
  }
];

export default function HomePage() {
  return (
    <main className="landing" id="main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <h1 id="landing-title">A clearer acne plan.</h1>
            <p className="landing-offer">AI skin analysis. Affordable products. Nutrition in context.</p>
            <p className="landing-summary">
              Measure visible acne-related patterns, get one budget-aware skincare action, and track
              whether the real measurements change without hiding uncertainty.
            </p>
            <div className="landing-actions">
              <Link className="button landing-primary-action" href="/scan/new?demo=true">
                Start acne analysis <ArrowRight size={18} />
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
              <span>Acne pattern</span>
              <strong>60</strong>
            </div>
            <div className="scan-marker scan-marker-pores">
              <span>Oiliness</span>
              <strong>45</strong>
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
        <span>Acne scan</span><CircleDot size={14} /><span>Affordable plan</span><CircleDot size={14} /><span>Nutrition context</span><CircleDot size={14} /><span>Simulation</span>
      </div>

      <section className="landing-method" id="method" aria-labelledby="method-title">
        <div className="landing-method-visual">
          <Image
            src="/images/routine-editorial.png"
            alt="Fictional adult applying moisturizer during a consistent skincare routine"
            fill
            loading="eager"
            sizes="(max-width: 920px) 100vw, 50vw"
          />
          <span className="visual-label visual-label-baseline"><Camera size={14} /> Acne baseline recorded</span>
          <span className="visual-label visual-label-routine"><LockKeyhole size={14} /> Budget-first plan</span>
        </div>

        <div className="landing-method-copy">
          <div>
            <p className="landing-kicker">An acne-first AI guidance loop</p>
            <h2 id="method-title">Scan. Recommend. Simulate. Verify.</h2>
            <p>
              SkinCause combines YouCam measurements with an OpenAI budget-aware product suggestion
              and nutrition context, then keeps the real follow-up evidence beside the illustration.
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
        <span className="statement-tag tag-measured">Acne focused</span>
        <span className="statement-tag tag-private">Affordable</span>
        <span className="statement-tag tag-repeatable">Nutrition tracked</span>
        <span className="statement-tag tag-honest">Uncertainty visible</span>
        <p className="landing-kicker">Guidance without overclaiming</p>
        <h2 id="statement-title">
          See the acne pattern.<br />
          <span>Choose one accessible action.</span><br />
          Measure what happens next.
        </h2>
        <p>
          SkinCause measures cosmetic acne-related signals and organizes sourced guidance. It does
          not diagnose acne, prescribe treatment, or promise that a product or diet will improve skin.
        </p>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <div>
          <p className="landing-kicker">Your image. Your timeline. Your control.</p>
          <h2 id="final-title">Try the acne scan, affordable recommendation, and simulation journey.</h2>
        </div>
        <Link className="button" href="/scan/new?demo=true">Open the demo <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
