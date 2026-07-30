**SKINCAUSE**

**Codex Build Specification**

*A cross-platform skincare-routine debugger powered by YouCam Skin AI*

Implementation-ready product requirements, cross-platform architecture, data model, API
contract, test plan, and copy-paste Codex prompts

| **Document metadata**   | **Value**                                         |
|-------------------------|---------------------------------------------------|
| **Document version**    | 1.1 - mobile-ready architecture                     |
| **Prepared**            | July 24, 2026                                     |
| **Target**              | Responsive web MVP with a low-friction Android/iOS port |
| **Primary integration** | Perfect Corp. YouCam AI Skin Analysis API v2.1    |
| **Recommended stack**   | pnpm/Turborepo, Next.js, Expo React Native, TypeScript, Supabase, OpenAPI, Vitest |

**Build principle: do not diagnose. Measure changes, control variables,
and communicate uncertainty.**

**Portability principle: the web app is a client, not the product core. Keep domain logic, schemas, and server workflows independent of React and Next.js so Android and iOS can reuse them.**

## **2026-07-29 Product Refocus**

SkinCause is now acne-first. The primary journey combines four connected
capabilities:

1.  YouCam Skin Analysis measures visible acne/blemish patterns and relevant
    supporting cosmetic signals such as oiliness, redness, pores, and texture.
2.  OpenAI organizes one affordable skincare product action using the scan,
    routine history, experiment evidence, a user budget, and local availability.
3.  Nutrition guidance provides conservative, source-backed context and a
    trackable observation. It must not prescribe a restrictive diet, supplement,
    or claim that food caused a breakout.
4.  YouCam Skin Simulation creates an illustrative appearance based on selected
    cosmetic measurement changes. It is a visual experiment goal, not a forecast
    of what a product will do.

The controlled one-change experiment remains the trust layer underneath the
experience. The product must say “visible acne pattern,” “acne-related cosmetic
signal,” or “acne-focused guidance” instead of claiming to detect, diagnose,
treat, or cure acne. Product price and availability must be presented as
time-sensitive information that the user should verify.

# **0. How to Use This Specification**

This document is designed so Codex can create the project from an empty
repository without inventing core product behavior. Use it as the source
of truth, and execute the phases in order.

1.  Create a pnpm workspace repository and add this specification as
    docs/SKINCAUSE_BUILD_SPEC.md. The required structure is a monorepo with
    apps/web, an optional apps/mobile Expo shell, and shared packages.

2.  Copy Appendix A into a root-level AGENTS.md file. This gives Codex
    durable engineering, privacy, safety, and testing rules.

3.  Paste the Master Codex Prompt from Section 18 into Codex. Ask it to
    complete one phase at a time and commit only after tests pass. Do not let
    Codex place business rules exclusively in Next.js pages, Server Actions,
    or browser-only hooks.

4.  Keep YOUCAM_MOCK_MODE=true until the complete user journey passes
    locally and in Playwright.

5.  Add the YouCam API key only through a secure environment variable.
    Never expose it to the browser or commit it.

6.  Before the demo, switch mock mode off, validate a real scan, then
    switch it back on for automated tests. Use Appendix E when you are ready
    to generate the Expo Android/iOS client from the same contracts.

> **Codex operating rule** Codex must inspect the repository, implement
> the smallest complete vertical slice, run lint/typecheck/unit/E2E
> tests, fix failures, and report exact commands and results before
> moving to the next phase.

## **Document Map**

| **Section** | **Purpose**                                                              |
|-------------|--------------------------------------------------------------------------|
| 1-3         | Product definition, user problem, boundaries, and measurable success     |
| 4-7         | MVP behavior, user journeys, screens, and functional requirements        |
| 8-12        | Architecture, API integration, database, privacy, and association engine |
| 13-16       | Error handling, testing, analytics, deployment, and demo plan            |
| 17-18       | Phased Codex execution plan and master build prompt                      |
| Appendices  | AGENTS.md, environment variables, mock contract, and launch checklist    |

## **Assumptions Chosen for the MVP**

| **Decision**          | **Chosen approach**                                                     | **Reason**                                                               |
|-----------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------------|
| Application model     | Web-first monorepo with a versioned API and shared client/domain packages | Fast judge onboarding without coupling the product to a browser |
| Analysis domain       | Cosmetic skin concerns and user-observed discomfort only                | Avoids medical diagnosis and unsupported treatment claims                |
| Experiment model      | One planned routine change at a time                                    | Makes before/after evidence interpretable                                |
| Recommendation engine | Deterministic association score with visible inputs                     | More trustworthy and testable than free-form AI conclusions              |
| Image retention       | Scores retained; original images deleted by default unless user opts in | Minimizes sensitive image storage on web, Android, and iOS |
| External APIs         | YouCam required; all others optional and isolated behind server adapters | Protects web and native clients from vendor-specific changes |

# **1. Product Definition**

*What Codex is building and what the product must prove.*

SkinCause helps a user investigate whether a recently introduced
skincare product is associated with a visible or self-reported worsening
in their skin. It creates a controlled, time-based experiment: document
the routine, establish a baseline, change one product, repeat
standardized scans, and compare the evidence.

> **Core value proposition** Most skincare tools recommend additional
> products. SkinCause helps users determine whether something already in
> their routine may be contributing to an unwanted change.

## **One-Sentence Pitch**

SkinCause is a privacy-first routine debugger that combines repeatable
YouCam Skin AI scans with structured N-of-1 experiments to identify
likely product associations without pretending to provide a medical
diagnosis.

## **Primary User**

A consumer who recently changed one or more skincare products and now
notices an unwanted cosmetic change, but cannot tell which product,
behavior, or environmental change is associated with it.

## **Jobs to Be Done**

- When my skin changes after I update my routine, help me reconstruct
  what changed.

- Help me run a simple experiment without accidentally changing several
  variables at once.

- Show whether the visible trend and my own observations move together.

- Tell me when the evidence is too weak or confounded to support a
  conclusion.

- Let me delete my photos and data without contacting support.

## **Product Promise**

The product does not promise to identify an allergy, disease, ingredient
intolerance, or medically safe treatment. It promises to organize
observations and compute an explainable association estimate from
repeated measurements.

# **2. Problem and Differentiation**

## **Current Failure Mode**

A user changes a cleanser, serum, moisturizer, and makeup product in the
same week. A breakout or redness appears. The user searches social
media, removes products randomly, buys replacements, and cannot
distinguish improvement caused by time from improvement caused by a
specific change.

## **Why Existing Approaches Fall Short**

| **Existing approach**  | **Failure**                                                                  | **SkinCause response**                                     |
|------------------------|------------------------------------------------------------------------------|------------------------------------------------------------|
| Single selfie analyzer | Produces a snapshot but no causal context                                    | Builds a longitudinal experiment around repeated scans     |
| Ingredient checker     | Flags ingredients generically without knowing the user or sequence of events | Prioritizes actual timing and observed trend               |
| Routine recommender    | Adds products and introduces more variables                                  | Locks the routine and changes one variable at a time       |
| Photo diary            | Stores images but does not structure the experiment                          | Computes trend, adherence, and confounder penalties        |
| Chatbot advice         | May sound certain without measurable evidence                                | Uses deterministic scoring and explicit uncertainty labels |

## **Hackathon Innovation**

YouCam is not used as a decorative scan result. The API output becomes a
measurement instrument inside a controlled decision workflow. The
project demonstrates memory, repeated analysis, data normalization,
experimental protocol, evidence scoring, privacy controls, and
explainable results.

# **3. Scope, Non-Goals, and Safety Boundaries**

## **MVP Scope**

- Guest demo mode plus optional Supabase email authentication.

- Manual skincare product entry with start date, usage period,
  frequency, and routine slot.

- Guided selfie capture or image upload with quality instructions.

- Server-side YouCam Skin Analysis API integration with mock mode.

- Baseline scan and repeated follow-up scans.

- One active elimination or reintroduction experiment per user.

- Check-ins for adherence, self-observed discomfort, and confounders.

- Deterministic association score with Low, Moderate, or Strong evidence
  wording.

- Timeline, comparison view, privacy controls, and complete data
  deletion.

- Responsive, accessible web UI suitable for a three-minute demonstration.

- A versioned JSON API, generated typed client, shared domain package, and platform-neutral upload flow that can be consumed by an Expo React Native app.

- A minimal Expo mobile shell may be included after the web P0 flow is stable; full native feature parity is not required for the hackathon MVP.

## **Explicit Non-Goals**

- Diagnosing acne, eczema, dermatitis, rosacea, allergy, infection, or
  any disease.

- Telling the user that a product or ingredient is medically safe or
  unsafe.

- Prescribing a treatment, medication, or exact recovery timeline.

- Automatically scraping product claims or presenting unverified
  ingredient risk scores in the MVP.

- Claiming that a statistical association proves causation.

- Supporting multiple simultaneous experiments in the initial release.

- Building a social network, marketplace, or clinician portal for the
  hackathon MVP.

- Duplicating business logic separately in web, Android, and iOS clients.

- Depending on browser-only cookies, File objects, Server Actions, or DOM APIs in shared domain code.

## **Required Safety Language**

> **Persistent product disclaimer** SkinCause provides cosmetic tracking
> and organizational insights, not medical diagnosis or treatment.
> Results may be affected by lighting, camera quality, routine
> adherence, time, and other changes.

When a user reports severe, rapidly worsening, or concerning symptoms,
the application must stop the experiment flow and display neutral
guidance to discontinue the experiment and contact a qualified
healthcare professional. The MVP must not enumerate a clinical symptom
checklist unless a medically reviewed policy is supplied by the project
owner.

# **4. MVP User Journey**

## **Happy Path**

| **Step**           | **Experience**                                                                                |
|--------------------|-----------------------------------------------------------------------------------------------|
| 1\. Enter          | User opens the landing page and chooses “Start a guided investigation.”                       |
| 2\. Consent        | User acknowledges cosmetic-only scope, image processing, and data controls.                   |
| 3\. Add routine    | User enters current products and identifies when each product was introduced.                 |
| 4\. Baseline       | User captures a standardized selfie and receives normalized skin concern results.             |
| 5\. Select suspect | The app ranks recently changed products by temporal relevance; the user chooses one.          |
| 6\. Plan           | The app creates a one-change experiment and locks the rest of the routine.                    |
| 7\. Check in       | User records adherence, optional confounders, observations, and a follow-up scan.             |
| 8\. Compare        | The dashboard shows visible trend, self-report trend, adherence, and confounders.             |
| 9\. Interpret      | The app presents an association level and explains why confidence is limited or strengthened. |
| 10\. Decide        | User ends the experiment, exports a summary, or starts a reintroduction experiment.           |

## **Demo Mode Journey**

The landing page includes “View seeded demo.” This creates a local or
seeded workspace containing three products, a baseline scan, two
follow-ups, one confounder, and a completed result. Judges can
immediately understand the product even if live camera or API access
fails.

## **Critical Empty and Failure States**

- No routine products: show a simple three-field quick-add form.

- No recent product changes: allow the user to select any product
  manually and lower initial confidence.

- Scan quality failure: explain the exact corrective action and preserve
  the form state.

- YouCam timeout: keep the image pending, retry safely, and offer mock
  demo rather than losing progress.

- Insufficient check-ins: show “Too early to interpret” instead of a
  score.

- High confounding: show the confounders and state that the experiment
  cannot distinguish the suspected product from other changes.


## **Cross-Platform Journey Parity**

The same account, products, experiments, scans, and results must be available to any authorized client. A user may start on the web and continue on Android or iOS without data migration. Client applications may differ in navigation and camera UX, but they must call the same versioned API and render the same normalized domain models.

| **Capability** | **Web implementation** | **Android/iOS implementation** |
|---|---|---|
| Authentication | Supabase session in browser | Supabase native session stored in secure storage |
| Photo capture | File picker or browser camera | Expo Camera/ImagePicker |
| Upload | API-issued upload session | Same API-issued upload session |
| Scan progress | Foreground polling | Foreground polling with resumable status refresh after app resume |
| Reminders | Optional email | Future local/push notification adapter |
| Results | Responsive web cards/charts | Native screens using the same DTOs and wording helpers |

# **5. Screens and Interaction Requirements**

| **Route**           | **Screen**              | **Required content**                                                       |
|---------------------|-------------------------|----------------------------------------------------------------------------|
| /                   | Landing                 | Problem, how it works, privacy promise, live CTA, seeded demo CTA          |
| /consent            | Consent                 | Cosmetic-only scope, image handling, retention choice, acceptance checkbox |
| /onboarding         | Routine setup           | Quick-add products, dates, AM/PM, frequency, recently changed marker       |
| /scan/new           | Guided scan             | Camera/upload, instructions, quality status, submit, processing state      |
| /dashboard          | Investigation dashboard | Current experiment, latest trend, next action, routine lock status         |
| /products           | Routine inventory       | Products, usage history, active/inactive state, edit audit                 |
| /experiments/new    | Experiment planner      | Suspect selection, reason, one-change rule, start date                     |
| /check-in           | Check-in                | Adherence, observations, confounders, scan, notes                          |
| /experiments/\[id\] | Experiment detail       | Timeline, comparison, evidence components, uncertainty                     |
| /results/\[id\]     | Result summary          | Association label, plain-language explanation, next options                |
| /privacy            | Privacy center          | Retention settings, image list, delete images, export, delete account      |

## **Design Direction**

- Calm clinical-adjacent visual language without presenting the app as a
  medical device.

- Warm neutral background, navy text, teal actions, and limited use of
  red only for safety interruptions.

- Progress is shown as timelines and evidence cards, not as dramatic
  “before/after” marketing claims.

- Every result card includes a “Why this result?” disclosure.

- Mobile-first camera and check-in flows; desktop dashboard uses a
  two-column layout.

- WCAG-minded contrast, keyboard navigation, visible focus, meaningful
  form labels, and reduced-motion support.


## **Mobile Portability Requirements**

- Design every primary action for touch targets of at least 44 by 44 points and avoid hover-only behavior.
- Do not depend on wide tables for P0 workflows. On narrow screens, render cards or labeled rows.
- Keep forms in small resumable steps so a mobile operating system interruption does not lose progress.
- Represent photos with a platform-neutral `LocalImageAsset` object containing URI, MIME type, dimensions, and optional byte size. Shared code must not accept DOM `File` as its domain type.
- Use design tokens for spacing, type scale, radii, status semantics, and motion. Keep tokens in `packages/design-tokens`; web Tailwind and native StyleSheet/theme code consume generated outputs.
- Keep navigation definitions client-specific. Domain packages must not import Next.js routing or Expo Router.
- All result wording, error mapping, experiment state labels, and score formatting must come from shared packages so web and native do not drift.
- Persist draft IDs and active scan IDs locally. After app reload or native resume, the client must query the server rather than restart a paid analysis.

# **6. Functional Requirements**

| **ID** | **Capability**       | **Acceptance statement**                                                                 | **Priority** |
|--------|----------------------|------------------------------------------------------------------------------------------|--------------|
| FR-001 | Guest demo           | A judge can open a complete seeded investigation without creating an account.            | P0           |
| FR-002 | Consent              | No image upload occurs until the user accepts processing and cosmetic-only scope.        | P0           |
| FR-003 | Routine inventory    | User can create, edit, stop, and restart products with dated history.                    | P0           |
| FR-004 | Scan capture         | User can capture or upload a supported image and see guidance before submission.         | P0           |
| FR-005 | YouCam adapter       | Backend performs file request, upload, task creation, status polling, and normalization. | P0           |
| FR-006 | Mock adapter         | The identical domain interface returns deterministic fixture results without API units.  | P0           |
| FR-007 | Baseline             | An experiment cannot start without at least one valid baseline scan.                     | P0           |
| FR-008 | Single-variable plan | Only one product status may change in an active experiment.                              | P0           |
| FR-009 | Check-in             | User records adherence, observation ratings, confounders, and optional notes.            | P0           |
| FR-010 | Association engine   | System computes a deterministic evidence result from configured inputs.                  | P0           |
| FR-011 | Explainability       | Each result shows component contributions and limitations.                               | P0           |
| FR-012 | Privacy deletion     | User can delete stored images separately from derived scores.                            | P0           |
| FR-013 | Full deletion        | User can permanently delete account/workspace data.                                      | P0           |
| FR-014 | Export               | User can export a plain-language experiment summary as JSON and printable HTML.          | P1           |
| FR-015 | Reintroduction       | Completed elimination experiment can be cloned into a reintroduction experiment.         | P1           |
| FR-016 | Notifications        | Optional email reminders for check-ins.                                                  | P2           |
| FR-017 | Versioned API        | Every P0 mutation and query is available under `/api/v1` and documented by OpenAPI.      | P0           |
| FR-018 | Shared SDK           | Web and future mobile clients consume generated API types and a shared API client.       | P0           |
| FR-019 | Platform-neutral image | Scan input uses URI/metadata or binary streams, not a browser-only File domain type.    | P0           |
| FR-020 | Session portability  | Bearer-token authentication works for browser and native clients; no cookie-only route.  | P0           |
| FR-021 | Resume scan          | A client can recover an in-progress scan from its ID after reload or app resume.          | P0           |
| FR-022 | Mobile shell         | Optional Expo app proves sign-in, dashboard read, capture, upload, and scan status reuse. | P1           |

## **Global Acceptance Rules**

- No page may expose the YouCam API key or direct authenticated API
  request in browser code.

- No result may use the words “caused,” “diagnosed,” “allergic,” or
  “safe” as a definitive conclusion.

- The application must remain usable with YOUCAM_MOCK_MODE=true.

- A failed integration call must not create duplicate paid tasks when
  retried.

- All persisted rows must be scoped to the authenticated user or guest
  workspace.

- All P0 flows must have automated tests and visible error states.

- No business rule may exist only in a React component, Next.js page, Server Action, or mobile screen.

- Every API response must be JSON-serializable, versioned, validated, and safe for untrusted clients.

- Authentication must accept an `Authorization: Bearer <Supabase access token>` path for native clients. Browser session helpers may be added, but cannot be the only mechanism.

- Shared packages may depend on TypeScript and portable libraries, but not on `window`, `document`, Node-only file APIs, Next.js, React Native, or Expo unless the package is explicitly platform-specific.

# **7. Cross-Platform Technical Architecture**

## **Architecture Goal**

Build the web MVP quickly without creating a rewrite trap. The source of truth is a versioned backend contract plus platform-neutral domain packages. Next.js and Expo are replaceable clients around the same product core.

## **Recommended Stack**

| **Layer** | **Choice** | **Rationale** |
|---|---|---|
| Workspace | pnpm workspaces with Turborepo | One repository, cached tasks, shared TypeScript packages |
| Web client | Next.js App Router | Fast hackathon delivery and responsive judge demo |
| Native client | Expo React Native with Expo Router | One Android/iOS codebase and easy device preview |
| API transport | Versioned REST/JSON under `/api/v1` with OpenAPI 3.1 | Language- and platform-neutral contract |
| API implementation | Next.js Route Handlers that call framework-independent service modules | Deploys with the web app now and can be extracted later |
| Domain logic | Pure TypeScript packages | Reused by web, native, tests, and background jobs |
| Validation | Zod schemas as canonical DTO definitions; generate OpenAPI and client types | Prevents contract drift |
| Server data | Supabase Postgres, Auth, private Storage, Row Level Security | Shared backend for all clients |
| Client data | TanStack Query in web and mobile | Consistent caching, retry, invalidation, and resume behavior |
| Forms | React Hook Form with adapters; shared Zod schemas | Reuse validation while keeping UI platform-specific |
| Testing | Vitest, Testing Library, Playwright, optional Maestro for Expo | Unit, contract, web E2E, and native smoke coverage |
| Deployment | Vercel plus Supabase; Expo EAS development build later | Simple web launch and direct path to native packages |

## **Hard Portability Rules**

1. Do not use Next.js Server Actions as the only mutation interface. Every P0 operation must have a documented `/api/v1` endpoint.
2. Do not place product rules in route handlers. Route handlers authenticate, validate, call a service, and serialize a DTO.
3. Do not import Next.js, React, Expo, React Native, DOM, or Node APIs into `packages/domain`, `packages/contracts`, or `packages/association-engine`.
4. Do not expose Supabase service-role credentials or YouCam credentials to either client.
5. Do not make clients call YouCam directly. Both web and mobile call SkinCause APIs only.
6. Do not represent captured images as DOM `File` in contracts. Use metadata plus an upload session, stream, or multipart boundary at the edge.
7. Do not make cookies mandatory. Native clients authenticate with a Supabase access token in the Authorization header.
8. All dates cross the API as ISO 8601 UTC strings. Clients localize for display.
9. All enums and user-visible status/error wording come from shared contracts or domain helpers.
10. API breaking changes require a new major route version; additive fields remain backward compatible.

## **Logical Component Diagram**

```text
                       ┌───────────────────────────────┐
                       │ packages/contracts            │
                       │ Zod DTOs + OpenAPI + enums    │
                       └──────────────┬────────────────┘
                                      │ generated types/client
                 ┌────────────────────┴────────────────────┐
                 │                                         │
        ┌────────▼────────┐                       ┌────────▼────────┐
        │ apps/web         │                       │ apps/mobile      │
        │ Next.js UI       │                       │ Expo React Native│
        │ browser capture  │                       │ native capture   │
        └────────┬─────────┘                       └────────┬─────────┘
                 └──────────────── HTTPS /api/v1 ──────────┘
                                      │ Bearer token
                           ┌──────────▼───────────┐
                           │ apps/web API routes  │
                           │ thin transport layer │
                           └──────────┬───────────┘
                                      │
                           ┌──────────▼───────────┐
                           │ packages/server-core │
                           │ auth, services, repos│
                           │ experiment policy    │
                           │ scan orchestration   │
                           └───────┬────────┬─────┘
                                   │        │
                       ┌───────────▼───┐ ┌──▼────────────────┐
                       │ Supabase       │ │ SkinAnalysisProvider│
                       │ DB/Auth/Storage│ │ YouCam or mock       │
                       └───────────────┘ └─────────────────────┘
```

## **Repository Layout**

```text
skincause/
  AGENTS.md
  README.md
  package.json
  pnpm-workspace.yaml
  turbo.json
  .env.example
  apps/
    web/
      app/
        (marketing)/page.tsx
        consent/page.tsx
        onboarding/page.tsx
        dashboard/page.tsx
        scan/new/page.tsx
        experiments/[id]/page.tsx
        results/[id]/page.tsx
        privacy/page.tsx
        api/v1/.../route.ts
      components/
      lib/platform/web-image-adapter.ts
      tests/e2e/
    mobile/                         # P1 scaffold; may be omitted until web P0 passes
      app/
      components/
      lib/platform/native-image-adapter.ts
      app.config.ts
  packages/
    contracts/                      # Zod DTOs, enums, error schema, OpenAPI generation
    api-client/                     # fetch client usable by browser and React Native
    domain/                         # entities, state transitions, wording, policies
    association-engine/             # pure deterministic calculation
    server-core/                    # services, repositories, auth, provider orchestration
    design-tokens/                  # platform-neutral tokens and generated outputs
    test-fixtures/                   # deterministic mock and contract fixtures
  supabase/
    migrations/
    seed.sql
  docs/
    SKINCAUSE_BUILD_SPEC.md
    openapi.json                    # generated; never hand-edited
```

## **Package Dependency Direction**

```text
contracts              domain               association-engine
     ▲                     ▲                         ▲
     └────────── api-client│                         │
                           └──────── server-core ────┘
                                      ▲
                         apps/web API routes

apps/web UI ─────► api-client + contracts + domain + design-tokens
apps/mobile UI ──► api-client + contracts + domain + design-tokens
```

The UI applications must never import `server-core`. `server-core` may import portable domain packages, but portable packages must never import server or UI packages.

## **Client Abstractions**

```ts
export type LocalImageAsset = {
  uri: string;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  byteSize?: number;
  fileName?: string;
};

export interface ImageCaptureAdapter {
  capture(): Promise<LocalImageAsset | null>;
  chooseFromLibrary(): Promise<LocalImageAsset | null>;
}

export interface SecureSessionStore {
  getAccessToken(): Promise<string | null>;
  setSession(input: { accessToken: string; refreshToken: string }): Promise<void>;
  clear(): Promise<void>;
}
```

Implement browser and Expo adapters separately. The shared API client accepts an injected `getAccessToken` function and a fetch-compatible implementation.

## **Provider Boundary**

All server application code depends on `SkinAnalysisProvider`, not direct YouCam calls. The provider accepts server-resolved bytes or a server-controlled storage reference; clients never receive provider credentials or task identifiers unless they are intentionally mapped to safe internal IDs.

```ts
export interface SkinAnalysisProvider {
  createAnalysis(input: {
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    requestedConcerns: string[];
    idempotencyKey: string;
  }): Promise<{ externalTaskId: string }>;

  getAnalysis(externalTaskId: string): Promise<
    | { status: "queued" | "processing" }
    | { status: "failed"; code: string; message: string; retryable: boolean }
    | { status: "succeeded"; result: NormalizedSkinAnalysis }
  >;
}
```

## **Extraction Path Later**

The API may initially run inside Next.js Route Handlers. Because routes call `server-core` and serialize contract DTOs, a later mobile-scale deployment can move the same services into Fastify, NestJS, Cloud Run, or serverless functions without rewriting clients or domain logic. This extraction is not required for the hackathon.

# **8. YouCam Skin Analysis Integration**

> **Current official workflow** Use Bearer authentication server-side,
> request an upload destination and file_id, upload the image to the
> returned URL, create a skin-analysis task, poll task status, and
> normalize the result. Version-specific fields must be verified against
> the current API reference before production use.

## **Endpoints to Encapsulate**

| **Method** | **Endpoint**                           | **Purpose**                                                               |
|------------|----------------------------------------|---------------------------------------------------------------------------|
| POST       | /s2s/v2.1/file/skin-analysis           | Request upload information and a file identifier                          |
| PUT/POST   | requests.url returned by File API      | Upload image bytes exactly as required by the returned request metadata   |
| POST       | /s2s/v2.1/task/skin-analysis           | Create analysis task using uploaded file identifier and selected concerns |
| GET        | /s2s/v2.1/task/skin-analysis/{task_id} | Poll queued/processing/success/error status and retrieve output           |

## **Integration Sequence**

1\. Validate MIME type, file size, image dimensions, and user
authorization before consuming API units.

2\. Generate a stable idempotency key from user ID, local scan ID, and
image hash.

3\. Create a local scan row in pending_upload state.

4\. Call the File API with Authorization: Bearer YOUCAM_API_KEY.

5\. Upload the image to the returned requests.url using the exact method
and headers returned by the API.

6\. Create the task and persist externalTaskId before responding to the
client.

7\. Poll from the server with exponential backoff and a maximum elapsed
time.

8\. Normalize success output into internal concern scores, masks,
provider metadata, and capture-quality metadata.

9\. Mark terminal errors and expose a friendly corrective message;
retain raw provider payload only in development and redact URLs or
tokens.

## **Image Capture Requirements**

Every client scan screen must guide users toward a front-facing image with even
lighting, an unobstructed face, and adequate face size. Web uses a browser
capture adapter; Android/iOS uses Expo Camera or ImagePicker through the
same `LocalImageAsset` contract. The current
official documentation supports JPG/JPEG/PNG, requires images under 10
MB, and defines minimum dimensions that differ for SD and HD analysis.
Codex must implement configurable client-side validation and also
enforce it on the server.

| **Check**    | **MVP behavior**                                                                      |
|--------------|---------------------------------------------------------------------------------------|
| Format       | Accept JPG/JPEG/PNG; reject unsupported types before upload.                          |
| File size    | Reject files at or above configured maximum; default 10 MB.                           |
| Face framing | Show face oval and instructions; API remains the final validator.                     |
| Lighting     | Display practical guidance; optional Camera Kit quality feedback behind feature flag. |
| Orientation  | Front-facing, neutral, eyes open, no major obstruction.                               |
| Consistency  | Repeat the same guidance at every check-in to reduce measurement noise.               |
| Mobile URI   | Copy transient camera/library URIs into app-controlled cache before upload when required. |
| EXIF metadata | Normalize EXIF orientation server-side and preserve only required metadata.             |
| Resume       | Persist local scan ID before upload so interrupted native sessions can resume status.      |

## **Normalization Contract**

> export type NormalizedConcern = {
>
> key: string; // internal stable key, e.g. "redness"
>
> providerLabel: string;
>
> rawScore: number \| null;
>
> normalizedSeverity: number \| null; // 0..100; 100 means greater
> visible concern
>
> directionSource: "provider-doc" \| "configured" \| "unknown";
>
> maskUrl?: string; // short-lived; never treated as permanent
>
> };
>
> export type NormalizedSkinAnalysis = {
>
> provider: "youcam" \| "mock";
>
> providerVersion: string;
>
> analyzedAt: string;
>
> concerns: NormalizedConcern\[\];
>
> blendedMaskUrl?: string;
>
> captureWarnings: string\[\];
>
> rawSchemaVersion: string;
>
> };

Do not assume whether a higher vendor score means better or worse.
Create a metric mapping table with an explicit direction for each
concern based on the official schema. When direction is unknown, display
raw change only and exclude that concern from the aggregate association
score.

## **Mock Mode**

YOUCAM_MOCK_MODE=true must substitute MockSkinAnalysisProvider. Fixtures
should include success, slow processing, low-quality image error,
provider error, and schema-change cases. Mock responses must be
deterministic from the image hash or fixture selector so screenshots and
tests remain stable.

# **9. Data Model and Row-Level Security**

| **Table**          | **Key fields**                                                                          | **Purpose**                                             |
|--------------------|-----------------------------------------------------------------------------------------|---------------------------------------------------------|
| profiles           | id, display_name, created_at                                                            | One row per authenticated user                          |
| guest_workspaces   | id, secret_hash, expires_at                                                             | Optional guest demo persistence without account         |
| products           | id, user_id/workspace_id, name, brand, category, notes                                  | Logical product identity                                |
| routine_periods    | id, product_id, started_at, ended_at, cadence, time_of_day                              | Dated use history; never overwrite history              |
| scans              | id, owner_id, status, provider, external_task_id, captured_at, image_path, retain_image | Scan task and retention status                          |
| scan_concerns      | scan_id, concern_key, raw_score, normalized_severity, direction_source                  | Normalized time-series measurements                     |
| experiments        | id, owner_id, type, suspect_product_id, status, started_at, ended_at, hypothesis        | Elimination or reintroduction plan                      |
| experiment_rules   | experiment_id, locked_routine_snapshot, allowed_change                                  | One-change policy snapshot                              |
| check_ins          | id, experiment_id, scan_id, adherence, observations, notes, occurred_at                 | Repeated measurement event                              |
| confounders        | id, check_in_id, kind, severity, note                                                   | Optional deviations that reduce confidence              |
| experiment_results | experiment_id, association_level, score, components_json, generated_at                  | Deterministic output with reproducible inputs           |
| consents           | owner_id, version, accepted_at, image_retention_choice                                  | Auditable consent version                               |
| deletion_events    | owner_id, resource_type, requested_at, completed_at                                     | Privacy operation audit without storing deleted content |

## **Database Rules**

- All owner-scoped tables require Row Level Security. A user can select,
  insert, update, and delete only rows that resolve to their auth.uid()
  or signed guest workspace.

- routine_periods are append-oriented. Editing historical dates creates
  an audit-safe change rather than erasing prior history.

- scans store provider task identifiers and normalized results, but
  never the API key or upload authorization data.

- Private storage paths use owner ID prefixes and signed URLs with short
  expiry.

- Deleting a user cascades to all product, experiment, scan, and result
  rows, then deletes storage objects.

- Seeded demo data belongs to a public read-only demo workspace and
  contains no real personal images.

## **Suggested Scan State Machine**

> draft
>
> → validating
>
> → pending_upload
>
> → uploaded
>
> → task_created
>
> → processing
>
> → succeeded
>
> → normalized
>
> Terminal alternatives:
>
> validation_failed \| upload_failed \| provider_failed \| timed_out \|
> deleted

# **10. Experiment Policy and Association Engine**

## **Experiment Types**

| **Type**       | **Allowed change**                                                               | **Goal**                                                            |
|----------------|----------------------------------------------------------------------------------|---------------------------------------------------------------------|
| Elimination    | Stop or pause one selected product while keeping other routine periods unchanged | Observe whether selected concern trends improve after removal       |
| Reintroduction | Resume one selected product after a completed elimination experiment             | Observe whether the prior trend returns under controlled conditions |

## **Minimum Evidence Policy**

- At least one baseline scan is required to start.

- At least two valid follow-up check-ins are required before any
  association label is shown.

- A valid check-in requires adherence response and either a scan or
  structured observation; aggregate image evidence requires scans.

- The result is “Insufficient evidence” when required data is missing,
  concern score direction is unknown, or confounder burden is too high.

- The product never auto-starts reintroduction; the user explicitly
  chooses it after reviewing the first experiment.

## **Deterministic Score**

The numeric score is an internal evidence score, not a probability that
the product caused a condition. Use a 0-100 scale only to rank evidence
strength, then convert it to controlled language.

> imageTrend = weightedConcernImprovement(0..100)
>
> selfReportTrend = normalizedObservationImprovement(0..100)
>
> adherence = completedProtocolRatio(0..100)
>
> repeatability = trendConsistencyAcrossCheckIns(0..100)
>
> confounderPenalty = normalizedConfounderBurden(0..50)
>
> qualityPenalty = scanQualityOrMissingDataPenalty(0..40)
>
> score =
>
> 0.35 \* imageTrend +
>
> 0.25 \* selfReportTrend +
>
> 0.20 \* adherence +
>
> 0.20 \* repeatability -
>
> confounderPenalty -
>
> qualityPenalty
>
> score = clamp(score, 0, 100)

## **Result Labels**

| **Label**            | **Internal band** | **Required wording**                                                                                                     |
|----------------------|-------------------|--------------------------------------------------------------------------------------------------------------------------|
| Insufficient         | No score          | There is not enough clean, repeated evidence to interpret this experiment.                                               |
| Low association      | 0-39              | The observed changes do not consistently track the product change.                                                       |
| Moderate association | 40-69             | Some observed changes track the product change, but uncertainty or confounders remain.                                   |
| Strong association   | 70-100            | Repeated observations consistently track the product change under this experiment. This is still not proof of causation. |

## **Concern Trend Calculation**

- Use only concern keys configured as relevant to the experiment and
  with known score direction.

- Convert each scan to normalizedSeverity where 100 always means greater
  visible concern.

- Compare the median baseline severity with a recency-weighted median of
  follow-up severities.

- Cap extreme single-scan deltas to reduce camera and lighting noise.

- Require the direction of change to agree in a majority of valid
  follow-up scans for high repeatability.

- Never aggregate hidden provider scores without showing which concern
  measurements were used.

## **Explainability Object**

> {
>
> "associationLevel": "moderate",
>
> "score": 58,
>
> "components": {
>
> "imageTrend": 66,
>
> "selfReportTrend": 60,
>
> "adherence": 75,
>
> "repeatability": 55,
>
> "confounderPenalty": 12,
>
> "qualityPenalty": 3
>
> },
>
> "usedConcerns": \["redness", "texture"\],
>
> "limitations": \[
>
> "One check-in included a routine change outside the plan",
>
> "Only two follow-up scans were available"
>
> \]
>
> }

# **11. Versioned API, OpenAPI, and Client Contracts**

## **Contract Strategy**

`packages/contracts` is the source of truth for request DTOs, response DTOs, enums, pagination, and error envelopes. Generate `docs/openapi.json` from these schemas and generate or hand-maintain a small typed `packages/api-client` that works with standard `fetch` in browsers and React Native.

Do not return database rows directly. Map database records into stable DTOs. Do not expose storage paths, provider payloads, service identifiers, or secrets.

## **Authentication Contract**

- Native and web clients may send `Authorization: Bearer <Supabase access token>`.
- Web may additionally use Supabase cookie helpers, but route authorization must normalize both mechanisms into one `RequestActor`.
- Guest demo uses an explicit short-lived guest token or local seeded mode; do not infer ownership from an unsigned workspace ID.
- Every owner-scoped route authorizes the actor before calling a service.

## **Core `/api/v1` Routes**

| **Method** | **Route** | **Responsibility** | **Format** |
|---|---|---|---|
| GET | /api/v1/me | Return current profile and feature capabilities | JSON |
| GET | /api/v1/products | List products and active routine periods | JSON |
| POST | /api/v1/products | Create product and optional initial routine period | JSON |
| PATCH | /api/v1/products/:id | Update metadata or append a routine period | JSON |
| GET | /api/v1/experiments | List experiments for dashboard | JSON |
| POST | /api/v1/experiments | Validate baseline and one-change policy; create experiment | JSON |
| GET | /api/v1/experiments/:id | Return experiment timeline and permitted actions | JSON |
| POST | /api/v1/experiments/:id/check-ins | Create check-in and attach an optional scan ID | JSON |
| POST | /api/v1/experiments/:id/complete | Generate and freeze deterministic result | JSON |
| GET | /api/v1/experiments/:id/export | Return JSON or printable HTML summary | HTML/JSON |
| POST | /api/v1/scans/upload-sessions | Validate metadata and create local scan/upload instructions | JSON |
| PUT/POST | signed upload destination | Upload bytes without exposing YouCam credentials | binary |
| POST | /api/v1/scans/:id/submit | Confirm upload and start provider orchestration idempotently | JSON |
| GET | /api/v1/scans/:id | Return status, progress hint, normalized result, or safe error | JSON |
| DELETE | /api/v1/scans/:id/image | Delete retained image while optionally preserving scores | JSON |
| DELETE | /api/v1/account | Delete all owner data and storage objects | JSON |

A multipart `/api/v1/scans` convenience route may exist for the web MVP, but the upload-session flow is canonical because it handles native file URIs, large files, progress, and retries more reliably.

## **Standard Response Envelope**

```ts
export type ApiSuccess<T> = {
  data: T;
  meta?: { requestId: string; apiVersion: "v1" };
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
  meta: { requestId: string; apiVersion: "v1" };
};
```

## **Scan Upload and Resume Flow**

1. Client validates basic image metadata using shared schemas.
2. Client creates a `clientRequestId` UUID and stores it locally before network activity.
3. Client calls `POST /api/v1/scans/upload-sessions` with MIME type, dimensions, byte size, and request ID.
4. Server returns `scanId`, upload method, upload URL or internal upload endpoint, required headers, and expiry.
5. Client uploads bytes using a platform adapter and shows progress when available.
6. Client calls `POST /api/v1/scans/:id/submit`.
7. Server idempotently creates or resumes the provider task.
8. Client queries `GET /api/v1/scans/:id` until terminal, with lifecycle-aware pausing.
9. After browser reload or mobile app resume, the client reads persisted `scanId` and continues at step 8. It never creates a new paid task merely because the UI restarted.

## **Example Scan Responses**

```json
{
  "data": {
    "scanId": "uuid",
    "status": "processing",
    "pollAfterMs": 1500
  },
  "meta": { "requestId": "req_uuid", "apiVersion": "v1" }
}
```

```json
{
  "data": {
    "scanId": "uuid",
    "status": "succeeded",
    "result": { "provider": "youcam", "concerns": [] }
  },
  "meta": { "requestId": "req_uuid", "apiVersion": "v1" }
}
```

```json
{
  "error": {
    "code": "IMAGE_TOO_DARK",
    "message": "Move to even front lighting and retake the photo.",
    "retryable": true
  },
  "meta": { "requestId": "req_uuid", "apiVersion": "v1" }
}
```

## **API Client Requirements**

`packages/api-client` must:

- Accept `baseUrl`, `getAccessToken`, and an injected fetch implementation.
- Attach bearer tokens without storing them in module globals.
- Parse success and error envelopes through contract schemas.
- Support `AbortSignal`.
- Avoid Node-only modules so it runs in browser and React Native.
- Expose domain-oriented methods such as `createExperiment`, `createUploadSession`, `submitScan`, and `getScan`, not raw URL strings throughout UI code.
- Preserve request IDs for support logs without logging sensitive content.

## **Idempotency and Retry Rules**

- Every mutation that can create external cost or duplicate state accepts `clientRequestId` or `Idempotency-Key`.
- The server stores a unique constraint on owner ID plus operation plus client request ID.
- Repeating the same request returns the existing resource and status.
- Query retries may use bounded exponential backoff. Mutation retries must reuse the same idempotency key.
- A native client may retry an interrupted upload only while the upload session remains valid; otherwise it requests a replacement session for the same local scan.
- Provider timeouts preserve the internal scan and allow an explicit resume or retry policy without silently creating a second task.

## **Compatibility Policy**

- `/api/v1` responses may add optional fields but cannot remove or reinterpret existing fields.
- Unknown enum values must map to an `unknown` UI state rather than crash older mobile builds.
- Mobile releases may remain installed for months; server changes must support at least the current and previous published mobile client contract.
- Include `minimumSupportedClientVersion` and feature capability fields in `/api/v1/me` before distributing a native production build.

# **12. Privacy, Security, and Responsible UX**

## **Privacy Defaults**

- Original scan image retention is off by default.

- When retention is off, delete the original after the provider result
  is normalized and the user-visible result is ready.

- When retention is on, store images only in a private bucket and show
  the user each stored image in the Privacy Center.

- Derived concern scores may be retained for trend history until the
  user deletes the investigation or account.

- Do not use user images for model training, demos, or analytics.

- Do not log image bytes, local device URIs, signed storage URLs, Authorization headers, refresh tokens, push tokens, or full raw provider payloads in production.

## **Security Controls**

| **Threat**          | **Required control**                                                                                                     |
|---------------------|--------------------------------------------------------------------------------------------------------------------------|
| API key exposure    | Server-only environment variable; static scan fails CI if web or native bundles contain the key name/value. |
| Cross-user access   | Supabase RLS plus normalized bearer/cookie authorization checks on every owner-scoped resource. |
| Malicious upload    | MIME sniffing, extension-independent validation, byte limit, dimension check, and re-encoding when practical.            |
| Duplicate API spend | Idempotency key and unique database constraint.                                                                          |
| Sensitive logs      | Structured allowlist logging with redaction and production log tests.                                                    |
| Long-lived URLs     | Use short-lived signed URLs; never persist provider URLs or embed them in mobile application state. |
| Deletion failure    | Deletion job records completion and surfaces retry state until both database and storage are cleared.                    |

## **Consent Copy Requirements**

The consent screen must explain: what image is processed, which external
processor receives it, whether the image is retained, how derived scores
are stored, how to delete data, and that the product is not medical
advice. Consent must be versioned in the database.

## **Result Language Guardrail**

| **Do not say**                         | **Use instead**                                                                                                                        |
|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| “This serum caused your breakout.”     | “The observed changes tracked the serum change during this experiment.”                                                                |
| “You are allergic to this ingredient.” | “SkinCause cannot identify an allergy. Consider stopping the experiment and consulting a qualified professional if you are concerned.” |
| “This product is safe.”                | “No strong negative association was observed in the available check-ins.”                                                              |
| “Your skin is cured.”                  | “The selected cosmetic concern decreased across the available scans.”                                                                  |

# **13. Error Handling and Resilience**

| **Code**                | **Source**                                 | **User message behavior**                                   | **Retry** |
|-------------------------|--------------------------------------------|-------------------------------------------------------------|-----------|
| IMAGE_TOO_SMALL         | Client/server validation or provider error | Choose a larger image or retake closer to the camera.       | True      |
| FACE_TOO_SMALL          | Provider validation                        | Center the face and move closer so it fills the guide.      | True      |
| IMAGE_TOO_DARK          | Provider validation                        | Move to even front lighting and retake.                     | True      |
| FACE_OUT_OF_FRAME       | Provider validation                        | Keep the full face inside the guide.                        | True      |
| UNSUPPORTED_FORMAT      | Client/server validation                   | Upload a JPG or PNG image.                                  | True      |
| PROVIDER_RATE_LIMIT     | YouCam response                            | Wait and retry; do not create repeated tasks automatically. | True      |
| PROVIDER_SCHEMA_CHANGED | Normalizer validation failure              | Show generic temporary failure and alert developers.        | False     |
| PROVIDER_TIMEOUT        | Polling deadline reached                   | Preserve scan and allow explicit retry.                     | True      |
| UNAUTHORIZED            | Session/RLS failure                        | Return to sign-in or seeded demo.                           | False     |
| DELETE_INCOMPLETE       | Storage/database partial failure           | Show deletion pending and retry server-side.                | True      |

## **Polling Policy**

Start at 1.5 seconds, increase to 3 seconds, then 5 seconds, add small
jitter, and stop after a configurable foreground deadline. Clients poll only
the internal status endpoint. Web pauses when the page is hidden; native pauses
when the app is backgrounded and refreshes immediately on resume. The server owns
provider polling state and avoids a thundering herd by coalescing requests or
refreshing only when `next_poll_at` has elapsed. Do not rely on continuous
background execution on Android or iOS for P0 correctness.

## **Schema Drift Protection**

- Validate all provider responses with Zod schemas.

- Preserve a redacted fixture from each successfully validated schema
  version.

- Fail closed when a required score meaning or direction is missing.

- Keep parsing logic isolated in integrations/youcam/schemas.ts and
  scan-normalizer.ts.

- Add a contract test that loads fixtures and confirms stable
  NormalizedSkinAnalysis output.

# **14. Testing Strategy and Definition of Done**

## **Required Commands**

> npm run lint
>
> npm run typecheck
>
> npm run test
>
> npm run test:integration
>
> npm run test:e2e
>
> npm run build
>
> npm run openapi:check
>
> npm run test:contracts
>
> npm run mobile:typecheck

## **Unit Tests**

- Association score boundaries, penalties, labels, and
  insufficient-evidence branches.

- Concern direction mapping and normalized severity conversion.

- Experiment policy rejects more than one routine change.

- Idempotency returns an existing scan.

- Result-language helper never emits prohibited definitive terms.

- Retention policy chooses delete versus private storage path correctly.

- Shared packages compile without DOM, Next.js, Expo, or Node imports unless explicitly allowed.

- API client attaches bearer tokens and parses envelopes identically in browser and React Native test environments.

## **Integration Tests**

- Mock provider success creates and normalizes a completed scan.

- Mock provider processing path returns 202 then success.

- Provider validation error maps to a user-correctable error code.

- Schema drift fixture fails safely and does not generate a result.

- RLS prevents user A from reading user B products, scans, and
  experiments.

- Account deletion removes database rows and storage objects.

- Every OpenAPI operation has a matching validated route and generated client method.

- Bearer-token authentication succeeds without cookies, and expired sessions return the standard error envelope.

- An interrupted upload/status flow resumes from the existing scan ID without creating another provider task.

## **Playwright End-to-End Tests**

- Seeded demo opens and displays a completed moderate-association
  experiment.

- New guest: consent → add products → mock baseline scan → start
  experiment.

- Check-in: adherence → confounder → mock scan → timeline update.

- Complete experiment → result explanation → printable export.

- Privacy center: retain image toggle → delete image → derived scores
  remain.

- Mobile viewport completes the main flow without horizontal scrolling.

## **Native Portability Tests**

- `apps/mobile` typechecks without importing web or server packages.
- Expo development build can sign in, list experiments, capture or select an image, upload it, and resume scan status.
- Contract fixture tests run against both web and native API-client configurations.
- Optional Maestro smoke test covers sign-in, dashboard, capture, and result status when a mobile shell is included.
- A dependency-boundary test fails when a portable package imports a platform-specific module.

## **Definition of Done**

> **A phase is complete only when** The implementation matches the
> acceptance criteria, lint and typecheck pass, relevant tests pass, no
> secrets are exposed, the UI has a useful loading/error/empty state,
> and Codex reports the files changed plus exact test output.

# **15. Analytics and Impact Measurement**

## **Privacy-Safe Product Events**

| **Event**          | **Meaning**                           | **Allowed properties**          |
|--------------------|---------------------------------------|---------------------------------|
| demo_opened        | A judge or user opened seeded demo    | No image or product name        |
| routine_completed  | At least two routine products entered | Count only                      |
| scan_submitted     | A scan was submitted                  | Provider/mock and status only   |
| experiment_started | One-change plan activated             | Experiment type only            |
| check_in_completed | A structured check-in saved           | No notes or scores              |
| result_generated   | Association result generated          | Label and data sufficiency only |
| image_deleted      | User deleted retained image           | Resource count only             |
| account_deleted    | User completed deletion               | Success/failure only            |

## **Hackathon Success Metrics**

- Time from landing page to first understandable value is under 60
  seconds in seeded demo.

- A first-time viewer can state the product’s difference from a skin
  analyzer after the demo.

- The live app completes the full scan-to-result journey without manual
  database intervention.

- All YouCam calls are visible in server logs and repository code, while
  the API key remains private.

- The result explicitly displays evidence, uncertainty, and
  non-diagnostic boundaries.

# **16. Deployment and Three-Minute Demo**

## **Deployment Checklist**

- Create Supabase production project and apply migrations.

- Enable RLS and run cross-user access tests against production-like
  environment.

- Configure Vercel environment variables and separate preview/production
  values.

- Keep mock mode enabled on preview branches; use real YouCam only on
  protected production demo.

- Verify HTTPS camera permissions, mobile upload, and private storage
  signed URLs.

- Run production build and Playwright smoke tests against deployed URL.

- Seed non-personal demo data and confirm it can be reset.

- Add a clear repository README with setup, architecture, environment
  variables, and test commands.

## **Recommended Three-Minute Storyboard**

| **Time**  | **Beat**                    | **On-screen proof**                                                               |
|-----------|-----------------------------|-----------------------------------------------------------------------------------|
| 0:00-0:20 | Problem                     | “I changed three skincare products and my skin worsened. Which change matters?”   |
| 0:20-0:45 | Routine reconstruction      | Show dated product timeline and select the most plausible recent suspect.         |
| 0:45-1:15 | YouCam scan                 | Capture or upload a selfie; show upload/task/poll processing and concern results. |
| 1:15-1:45 | Controlled experiment       | Start one-change plan; show locked routine and structured check-ins.              |
| 1:45-2:20 | Evidence                    | Compare baseline and follow-ups, self-report, adherence, and a confounder.        |
| 2:20-2:45 | Conclusion with uncertainty | Reveal moderate/strong association wording and “Why this result?” breakdown.      |
| 2:45-3:00 | Trust and impact            | Delete the image, retain scores, and state retail/customer-support value.         |

## **Demo Reliability Rules**

- Record the final video using deterministic seeded data, then include a
  brief live real-API proof.

- Keep a local mock toggle so a temporary provider outage cannot block
  judging.

- Do not spend the video explaining architecture before showing the user
  problem and result.

- Show server logs or a small “Powered by YouCam Skin Analysis”
  integration panel to prove the API path.

# **17. Phased Codex Execution Plan**

| **Phase** | **Deliverable** | **Gate** |
|---|---|---|
| Phase 0 - Monorepo contract | Create pnpm/Turborepo workspace, AGENTS.md, package boundaries, env schema, CI, and architecture decision record. | lint, workspace typecheck, dependency-boundary test, build |
| Phase 1 - Contracts and API skeleton | Create shared Zod DTOs, standard envelopes, `/api/v1` route skeleton, OpenAPI generation, and portable API client. | OpenAPI snapshot and contract tests |
| Phase 2 - Product shell | Create responsive web landing, consent, seeded demo, design tokens, navigation, and accessible primitives. | Playwright seeded-demo smoke test |
| Phase 3 - Data foundation | Create Supabase migrations, RLS, repositories, normalized bearer/cookie auth, guest workspace, seeds, and deletion service. | RLS and bearer-auth integration tests |
| Phase 4 - Routine and experiments | Implement product history, baseline requirement, one-change policy, dashboard, and check-ins through server-core and `/api/v1`. | Domain unit tests and web E2E |
| Phase 5 - Scan orchestration | Implement upload sessions, platform-neutral image metadata, provider interface, mock provider, state machine, resume behavior, and status UI. | interrupted/resumed mock E2E without duplicate task |
| Phase 6 - Real YouCam | Implement v2.1 adapter, schemas, errors, normalization, feature flags, and one manual live validation. | contract fixtures and live proof |
| Phase 7 - Association engine | Implement trend calculation, penalties, result bands, wording helpers, explanation DTO, comparison UI, and export. | exhaustive engine and language tests |
| Phase 8 - Mobile proof shell | Scaffold Expo app using the same contracts, API client, domain helpers, and design tokens. Implement sign-in, dashboard, capture/select, upload, and scan status. | mobile typecheck plus device/simulator smoke test |
| Phase 9 - Privacy and polish | Retention, privacy center, deletion UX, accessibility, observability, CORS/capabilities, and deploy. | full suite, production build, web and native-client smoke |
| Phase 10 - Submission assets | Screenshots, architecture diagram, demo reset, README, mobile-portability section, and three-minute video script. | submission checklist |

## **Prompt Template for Every Phase**

> Implement Phase <N> from docs/SKINCAUSE_BUILD_SPEC.md.
>
> Before editing:
>
> 1. Read AGENTS.md and the relevant specification sections.
> 2. Inspect the repository and summarize current package boundaries.
> 3. State the smallest complete vertical slice for this phase.
>
> During implementation:
>
> - Preserve the provider boundary, `/api/v1` contract, and safety language.
> - Keep domain rules outside UI components and framework route files.
> - Do not add a platform-specific dependency to a portable package.
> - Add loading, empty, error, offline/interruption, and accessible states where relevant.
> - Add or update unit, contract, integration, and E2E tests with the implementation.
>
> Before finishing:
>
> 1. Run lint, typecheck, OpenAPI checks, relevant tests, and builds.
> 2. Fix every failure caused by the change.
> 3. Report files changed, commands run, results, package-boundary impact, remaining risks, and the next phase.
> 4. Do not begin the next phase automatically.

## **Suggested Parallel Codex Worktrees**

After Phase 3 stabilizes contracts, separate Codex agents may work in isolated worktrees on web UI, Expo shell, YouCam fixtures, association-engine tests, and privacy/E2E tests. Shared contract changes require coordination and regenerated OpenAPI/client artifacts before merging.

# **18. Master Codex Build Prompt**

*Copy this into Codex after placing AGENTS.md and the specification in the repository.*

> You are the lead engineer for SkinCause, a hackathon-ready web-first, cross-platform application that uses Perfect Corp. YouCam AI Skin Analysis as a repeated measurement inside a controlled skincare-routine experiment.
>
> Read AGENTS.md and docs/SKINCAUSE_BUILD_SPEC.md completely before making changes. Treat them as the source of truth. Build from an empty or partially initialized repository using the phases in Section 17.
>
> Product behavior:
>
> - A user records a dated skincare routine.
> - The user completes a standardized baseline scan.
> - The user selects one suspect product and starts an elimination or reintroduction experiment.
> - The rest of the routine is locked as a snapshot.
> - Repeated check-ins collect adherence, optional confounders, observations, and follow-up scans.
> - A deterministic association engine calculates evidence strength and explains every component.
> - The app never diagnoses, asserts causation, or claims a product is medically safe or unsafe.
>
> Cross-platform architecture constraints:
>
> - Use pnpm workspaces and Turborepo with `apps/web`, optional `apps/mobile`, and shared packages.
> - Ship the hackathon experience in Next.js, but treat it as one API client rather than the product core.
> - Every P0 operation must be available through a versioned `/api/v1` JSON contract. Do not use Server Actions as the sole mutation interface.
> - Define request and response DTOs in `packages/contracts` using Zod, generate OpenAPI, and consume them through `packages/api-client`.
> - `packages/domain`, `packages/contracts`, `packages/association-engine`, and `packages/api-client` must remain usable by browser and Expo React Native.
> - Keep all business rules and provider orchestration in pure domain packages or `packages/server-core`; route handlers remain thin.
> - Accept bearer-token authentication for native clients. Browser cookies may be supported but cannot be required.
> - Use `LocalImageAsset` metadata and an upload-session flow; do not make DOM `File` the shared image model.
> - Persist `clientRequestId` and `scanId` before upload. A reload or app resume must continue the existing scan without creating a duplicate paid task.
> - Use shared design tokens and shared wording/error helpers, while keeping navigation and visual components platform-specific.
>
> Backend and integration constraints:
>
> - Supabase provides Postgres, authentication, private storage, and Row Level Security.
> - SkinAnalysisProvider has YouCam and deterministic mock implementations.
> - Keep `YOUCAM_MOCK_MODE=true` until the complete user journey passes.
> - YouCam credentials are server-only. Implement file request, upload, task creation, status polling, and normalization behind the provider adapter.
> - Verify exact v2.1 request and response fields against current official documentation before implementing the live adapter.
> - Use idempotency to prevent duplicate paid tasks.
> - Original image retention is off by default; derived scores may be retained.
>
> Quality and testing constraints:
>
> - Unit tests with Vitest, contract tests, integration tests, Playwright E2E, OpenAPI checks, and workspace dependency-boundary tests are required.
> - The seeded demo must work without external APIs.
> - Every provider and image failure must have a useful recovery state.
> - Every result must expose evidence and limitations.
> - No secret, image bytes, local device URI, signed URL, token, or sensitive note may appear in logs.
> - No TODO may remain in a P0 flow unless documented as a blocked external credential step.
>
> Execution rules:
>
> 1. Begin with Phase 0 only.
> 2. Inspect the repository and state what already exists before coding.
> 3. Implement the smallest complete vertical slice for the phase.
> 4. Add tests during implementation, not afterward.
> 5. Run lint, workspace typecheck, OpenAPI/contract checks, relevant tests, and production build.
> 6. Fix failures and inspect responsive pages when browser tooling is available.
> 7. End with files changed, commands run, passing tests, package-boundary impact, known limitations, and the exact next prompt.
> 8. Do not start a later phase until explicitly instructed.
>
> Start Phase 0 now.

# **Appendix A. Root AGENTS.md**

> \# SkinCause Engineering Instructions
>
> \## Mission
>
> Build a trustworthy, privacy-first, cross-platform routine debugger. Use repeated
> YouCam Skin AI measurements inside controlled single-variable
> experiments. Never present SkinCause as a diagnostic or treatment
> product. The web app is one client; preserve a direct path to Expo Android/iOS.
>
> \## Source of truth
>
> \- Read \`docs/SKINCAUSE_BUILD_SPEC.md\` before implementing a phase.
>
> \- Preserve documented routes, domain contracts, safety language,
> retention defaults, and acceptance criteria.
>
> \- When code and specification conflict, stop and report the conflict
> before changing the product contract.
>
> \## Working method
>
> \- Inspect before editing.
>
> \- Implement one complete vertical slice at a time.
>
> \- Prefer simple, typed, testable code over abstraction without a
> current use.
>
> \- Add tests with every behavior change.
>
> \- Run the relevant commands and fix failures before reporting
> completion.
>
> \- Never claim a command passed unless you ran it and saw a successful
> result.
>
> \## Required commands
>
> \- \`npm run lint\`
>
> \- \`npm run typecheck\`
>
> \- \`npm run test\`
>
> \- \`npm run test:integration\`
>
> \- \`npm run test:e2e\`
>
> \- \`npm run build\`
>
> \- \`npm run openapi:check\`
>
> \- \`npm run test:contracts\`
>
> \- \`npm run mobile:typecheck\`
>
> \## Safety language
>
> Never emit definitive claims using “caused,” “diagnosed,” “allergic,”
> “cured,” or “safe.” Use association and uncertainty language. The
> product is cosmetic tracking, not medical advice.
>
> \## Privacy and security
>
> \- Keep YouCam credentials server-only.
>
> \- Do not log images, image URLs, authorization headers, raw sensitive
> notes, or secrets.
>
> \- Default to deleting original images after normalized results are
> available.
>
> \- Enforce owner authorization in application code and Supabase RLS.
>
> \- Use idempotency for external paid tasks.
>
> \- Add deletion tests whenever storage or owner-scoped data changes.
>
> \## Integration architecture
>
> UI clients depend on \`packages/api-client\`, \`packages/contracts\`, portable domain helpers, and design tokens. They never import server-core or YouCam code.
>
> Every P0 operation has a \`/api/v1\` endpoint. Next.js Route Handlers are thin transport adapters that call \`packages/server-core\`.
>
> Application server code depends only on \`SkinAnalysisProvider\`. Keep YouCam request and response schemas behind the provider adapter. Mock mode remains a first-class supported path.
>
> Portable packages must not import Next.js, React, Expo, React Native, DOM, or Node-only APIs. Add a dependency-boundary test.
>
> Native clients use bearer tokens, platform image adapters, and the same upload-session and status contract as web.
>
> \## Definition of done
>
> A task is done only when implementation, empty/loading/error states,
> tests, typecheck, lint, and build are complete. Report files changed
> and exact command results.

# **Appendix B. Environment Variables**

> \# Public application
>
> NEXT_PUBLIC_APP_URL=http://localhost:3000
>
> NEXT_PUBLIC_SUPABASE_URL=
>
> NEXT_PUBLIC_SUPABASE_ANON_KEY=
>
> NEXT_PUBLIC_YOUCAM_CAMERA_KIT_ENABLED=false
>
> NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
>
> EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
>
> EXPO_PUBLIC_SUPABASE_URL=
>
> EXPO_PUBLIC_SUPABASE_ANON_KEY=
>
> \# Server-only Supabase
>
> SUPABASE_SERVICE_ROLE_KEY=
>
> \# YouCam - server only
>
> YOUCAM_API_KEY=
>
> YOUCAM_API_BASE_URL=https://yce-api-01.makeupar.com
>
> YOUCAM_API_VERSION=v2.1
>
> YOUCAM_MOCK_MODE=true
>
> YOUCAM_POLL_TIMEOUT_MS=90000
>
> YOUCAM_MAX_IMAGE_BYTES=10000000
>
> \# Privacy and product policy
>
> DEFAULT_RETAIN_ORIGINAL_IMAGES=false
>
> CONSENT_VERSION=2026-07-24
>
> GUEST_WORKSPACE_TTL_HOURS=24
>
> MINIMUM_SUPPORTED_MOBILE_VERSION=0.1.0
>
> ALLOWED_NATIVE_ORIGINS=
>
> \# Optional
>
> SENTRY_DSN=
>
> EMAIL_PROVIDER_API_KEY=
>
> **Secret naming rule** No secret variable may begin with \`NEXT_PUBLIC_\` or \`EXPO_PUBLIC_\`. Add CI checks that scan web and native bundles for server-only key names and configured secret values.

# **Appendix C. Deterministic Mock Scenario**

Use this seeded story for the landing-page demo and Playwright. All
imagery must be synthetic, licensed, or replaced by neutral
placeholders; do not include a real person’s face in the repository.

| **Element**       | **Seed value**                                                                                    |
|-------------------|---------------------------------------------------------------------------------------------------|
| Products          | Gentle Cleanser (existing), Barrier Moisturizer (existing), Brightening Serum (introduced June 1) |
| Experiment        | Elimination of Brightening Serum                                                                  |
| Baseline concerns | Redness 68, Texture 55, Pores 42                                                                  |
| Follow-up 1       | Redness 58, Texture 51, adherence 100%, no confounder                                             |
| Follow-up 2       | Redness 47, Texture 46, adherence 100%, unusual sun exposure confounder                           |
| Follow-up 3       | Redness 43, Texture 44, adherence 100%, no confounder                                             |
| Result            | Moderate or Strong association depending on configured penalties; wording must remain non-causal  |

## **Mock Provider Behavior**

> // fixture selector can be a query/header available only in
> development/test
>
> success-baseline → returns baseline concern values
>
> success-followup-1 → processing twice, then success
>
> success-followup-2 → success with capture warning
>
> error-too-dark → retryable IMAGE_TOO_DARK
>
> error-provider → retryable provider error
>
> error-schema-drift → malformed success payload rejected by Zod

# **Appendix D. Hackathon Submission Checklist**

- [ ] Public or shared repository contains source, migrations, seed,
  setup instructions, and license.

- [ ] README explains the problem, why it is not a one-call wrapper, and
  exactly where YouCam is used.

- [ ] Screenshots show routine reconstruction, scan processing,
  experiment timeline, evidence breakdown, and privacy deletion.

- [ ] One-to-three-minute video demonstrates the complete end-to-end
  journey on the intended device.

- [ ] Video and repository contain no unlicensed music, trademarks, or
  personal face imagery.

- [ ] Submission description names the YouCam API version and describes
  upload/task/poll integration.

- [ ] A judge can use seeded demo without credentials and can see a
  separate live integration proof.

- [ ] The application displays cosmetic-only, non-diagnostic boundaries.

- [ ] All tests and production build pass from a clean checkout.

- [ ] README explains that the web client, future Expo client, and backend share versioned contracts and domain packages.

- [ ] `docs/openapi.json` is generated and matches the checked-in contract snapshot.

- [ ] A non-browser smoke test can authenticate, read the dashboard, and resume a scan through `/api/v1`.

- [ ] Optional Expo proof shell demonstrates capture/upload/status reuse without duplicating business logic.

# **Appendix E. Native Android/iOS Port Plan**

## **What Is Reused Without Rewriting**

| **Artifact** | **Reuse in Expo** |
|---|---|
| `packages/contracts` | Request/response schemas, enums, error envelopes, status types |
| `packages/api-client` | Authentication-aware HTTP methods and scan resume operations |
| `packages/domain` | Experiment policy, labels, wording, date/state helpers |
| `packages/association-engine` | Deterministic calculations when safe to run client-side; server remains authoritative |
| `packages/design-tokens` | Typography, spacing, radius, and semantic status tokens |
| Supabase backend | Same accounts, RLS, products, experiments, scans, storage, and results |
| `/api/v1` | Same mutations, queries, upload sessions, status, and deletion flows |

## **What Remains Platform-Specific**

- Navigation and screen components.
- Camera and image-library access.
- Secure token storage using Expo SecureStore.
- File upload adapter for native URIs.
- App lifecycle handling and optional notifications.
- Accessibility semantics and platform permissions.

## **Minimum Expo Proof App**

1. Sign in or open seeded demo.
2. Fetch and display dashboard data.
3. Capture or select a photo using an `ImageCaptureAdapter`.
4. Create an upload session and upload the native URI.
5. Submit the scan and show processing state.
6. Background and resume the app; recover the same scan status.
7. Display the normalized result and limitations.
8. Delete the original image from the Privacy screen.

## **Copy-Paste Codex Prompt for the Native Port**

> Add or complete `apps/mobile` as an Expo React Native application for SkinCause. Do not rewrite the backend or domain logic.
>
> Read AGENTS.md and docs/SKINCAUSE_BUILD_SPEC.md. Reuse `packages/contracts`, `packages/api-client`, `packages/domain`, and `packages/design-tokens`. Do not import `packages/server-core` or YouCam integration code into the mobile app.
>
> Implement Expo Router screens for sign-in/demo, dashboard, scan capture, scan progress, experiment detail, result, and privacy. Use Supabase authentication with Expo SecureStore. Implement `ImageCaptureAdapter` with Expo Camera or ImagePicker and a native upload adapter that can send a local URI to the existing `/api/v1/scans/upload-sessions` flow.
>
> Persist `clientRequestId` and `scanId` before upload. Pause foreground polling when the app backgrounds and refresh the same scan immediately on resume. Never create a replacement provider task solely because the app restarted.
>
> Keep user-visible result wording and error messages from shared helpers. Add permission-denied, offline, interrupted-upload, expired-session, and retry states. Use the shared design tokens while implementing native components and accessibility semantics.
>
> Add mobile typecheck, contract fixture tests, and one device/simulator smoke test covering sign-in, capture/select, upload, processing, resume, and result. Report files changed, commands run, test results, and any contract changes. Do not modify `/api/v1` incompatibly.

# **Appendix F. Current Official References**


[<u>Perfect Corp. YouCam API Quick Start
Guide</u>](https://docs.perfectcorp.com/develop/quick_start_guide) —
Bearer authentication and file → upload → task → poll workflow.

[<u>Perfect Corp. AI Skin Analysis v2.1
Reference</u>](https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.1)
— Current v2.1 endpoints, masks, scores, and schema reference.

[<u>Perfect Corp. Skin Analysis File Specs and
Errors</u>](https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/file-specs-and-errors)
— Image requirements, camera guidance, Camera Kit, and error behavior.

[<u>Perfect Corp. Release
Notes</u>](https://docs.perfectcorp.com/release/changelog) — Version and
output changes that may affect normalization.

[<u>OpenAI: Introducing the Codex
App</u>](https://openai.com/index/introducing-the-codex-app/) — Codex
worktrees, skills, testing loops, and project-based agent workflow.

[<u>OpenAI: Running Codex
Safely</u>](https://openai.com/index/running-codex-safely/) —
Sandboxing, network boundaries, approvals, credentials, and telemetry.

**Implementation caution:** Check the live adapter against the latest
official schema at build time. Keep endpoint version, score mappings,
and output parsing configurable and covered by contract fixtures.
