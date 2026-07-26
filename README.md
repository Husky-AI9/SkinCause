# SkinCause

SkinCause is a privacy-first skincare routine debugger. It turns repeated skin measurements, routine history, adherence, and confounders into a controlled N-of-1 experiment. It organizes cosmetic observations and reports an explainable association estimate; it does not diagnose or claim causation.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Mock mode is enabled by default, so the full seeded journey works without Supabase or YouCam credentials.

## Architecture

- `apps/web`: Next.js App Router UI and thin `/api/v1` transport handlers
- `apps/mobile`: portable Expo proof-shell types and adapters
- `packages/contracts`: Zod API DTOs and envelopes
- `packages/api-client`: fetch-based client usable by web and React Native
- `packages/domain`: product policy, seeded story, wording, and error mapping
- `packages/association-engine`: deterministic evidence calculation
- `packages/server-core`: server-only orchestration and mock/YouCam provider boundary
- `packages/design-tokens`: shared platform-neutral visual tokens

Automated tests and preview deployments can use the credential-free mock. With `YOUCAM_MOCK_MODE=false`, the prepared synthetic scan and user uploads use live YouCam scores and concern masks. Production persistence is prepared through the checked-in Supabase migration and RLS policies; the browser never calls YouCam directly.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run openapi:check
npm run test:contracts
npm run mobile:typecheck
npm run build
npm run test:e2e
```

## Deploy to Vercel

SkinCause uses Supabase for authentication, durable scan state, and direct private image uploads.
The browser never sends scan image bytes through a Vercel Function.

1. Apply every SQL migration in `supabase/migrations` to the production Supabase project.
2. In Supabase Authentication settings, enable **Anonymous Sign-Ins** for the disposable demo workspace.
3. In Supabase URL Configuration, set **Site URL** to the production Vercel domain and add the required preview domains as redirect URLs.
4. Import the repository into Vercel and set **Root Directory** to `apps/web`.
5. Keep **Include source files outside of the Root Directory** enabled so workspace packages are available.
6. Use the detected Next.js framework settings. `apps/web/vercel.json` installs the frozen pnpm workspace and runs the web build.
7. Add the following Vercel Production environment variables:

```text
NEXT_PUBLIC_APP_URL=https://your-domain.example
NEXT_PUBLIC_API_BASE_URL=https://your-domain.example/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_ANONYMOUS_ENABLED=true
NEXT_PUBLIC_YOUCAM_CAMERA_KIT_ENABLED=false
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
YOUCAM_API_KEY=...
YOUCAM_API_BASE_URL=https://yce-api-01.makeupar.com
YOUCAM_API_VERSION=v2.1
YOUCAM_MOCK_MODE=false
YOUCAM_POLL_TIMEOUT_MS=90000
YOUCAM_MAX_IMAGE_BYTES=10000000
```

Use `YOUCAM_MOCK_MODE=true` in Vercel Preview unless a preview deployment is intentionally validating the paid provider. `YOUCAM_API_KEY_SECRET` is not consumed by the current server adapter and is not required in Vercel.

After deployment, run the Playwright smoke journey against the deployment URL and verify sign-in, anonymous demo entry, direct image upload, scan completion, image deletion, and account deletion.

## Safety

SkinCause provides cosmetic tracking and organizational insights, not medical diagnosis or treatment. Original images are not retained by default. Derived concern scores can be kept for trends and deleted independently through the Privacy Center.
