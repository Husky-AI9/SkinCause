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

The seeded demo is intentionally credential-free. Production persistence is prepared through the checked-in Supabase migration and RLS policies. The real YouCam path requires server-only `YOUCAM_API_KEY` and `YOUCAM_MOCK_MODE=false`; the browser never calls YouCam directly.

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

## Safety

SkinCause provides cosmetic tracking and organizational insights, not medical diagnosis or treatment. Original images are not retained by default. Derived concern scores can be kept for trends and deleted independently through the Privacy Center.
