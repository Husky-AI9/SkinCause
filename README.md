# SkinCause

## Android demo

SkinCause now includes an Expo Android client in `apps/mobile`. It uses the same
server API and Supabase anonymous-demo flow as the web app; API credentials for
YouCam and OpenAI remain server-side.

1. Install Android Studio and create/start an Android emulator.
2. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set the deployed
   API and Supabase public values.
3. Install workspace packages, then launch the emulator build:

   ```powershell
   npx.cmd pnpm@10.14.0 install
   npm.cmd run mobile:android
   ```

For a device or emulator that cannot reach the deployed API, use an accessible
API URL in `EXPO_PUBLIC_API_BASE_URL`. `10.0.2.2` is the Android-emulator alias
for a server running on the host machine.

SkinCause is a privacy-first, acne-focused skincare guidance app. YouCam measures
visible acne-related cosmetic patterns, OpenAI organizes one affordable product
action plus conservative nutrition context, and YouCam Skin Simulation creates
an illustrative experiment goal. Repeated scans and one-change experiments show
what happens afterward without claiming diagnosis, treatment, or causation.

## Run locally

```powershell
npx.cmd pnpm@10.14.0 install --frozen-lockfile
npm.cmd run dev
```

Open `http://localhost:3000`. Mock mode is enabled by default, so the full seeded journey works without Supabase or YouCam credentials.

## Architecture

- `apps/web`: Next.js App Router UI and thin `/api/v1` transport handlers
- `apps/mobile`: Expo Router Android/iOS client using the shared API and domain packages
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
NEXT_PUBLIC_YOUCAM_CAMERA_KIT_SCRIPT_URL=
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
YOUCAM_API_KEY=...
YOUCAM_API_BASE_URL=https://yce-api-01.makeupar.com
YOUCAM_API_VERSION=v2.1
YOUCAM_SIMULATION_API_URL=https://yce-api-01.makeupar.com/s2s/v2.0/task/skin-simulation
YOUCAM_MOCK_MODE=false
YOUCAM_POLL_TIMEOUT_MS=90000
YOUCAM_MAX_IMAGE_BYTES=10000000
OPENAI_API_KEY=...
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_RECOMMENDATION_MODEL=gpt-5.6-sol
OPENAI_MOCK_MODE=false
```

Use `YOUCAM_MOCK_MODE=true` and `OPENAI_MOCK_MODE=true` in Vercel Preview unless a preview deployment is intentionally validating paid providers. `YOUCAM_API_KEY_SECRET` is not consumed by the current server adapter and is not required in Vercel. OpenAI receives structured experiment measurements and routine product metadata, not scan images or raw check-in notes.

After deployment, run the Playwright smoke journey against the deployment URL and verify sign-in, anonymous demo entry, direct image upload, scan completion, image deletion, and account deletion.

## Safety

SkinCause provides cosmetic tracking and organizational insights, not medical diagnosis or treatment. Original images are not retained by default. Derived concern scores can be kept for trends and deleted independently through the Privacy Center.
