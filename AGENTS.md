# SkinCause Engineering Instructions

## Mission

Build a trustworthy, privacy-first, cross-platform routine debugger. Use repeated YouCam Skin AI measurements inside controlled single-variable experiments. Never present SkinCause as a diagnostic or treatment product. The web app is one client; preserve a direct path to Expo Android/iOS.

## Source of truth

- Read `docs/SKINCAUSE_BUILD_SPEC.md` before implementing a phase.
- Preserve documented routes, domain contracts, safety language, retention defaults, and acceptance criteria.
- Keep product rules outside UI components and framework route files.

## Safety and privacy

- Use association and uncertainty language. Never make definitive diagnostic or causation claims.
- Keep YouCam and Supabase service credentials server-only.
- Do not log images, image URLs, authorization headers, raw sensitive notes, or secrets.
- Default to deleting original images after normalized results are available.
- Use idempotency for external paid tasks.

## Definition of done

Implementation, loading/empty/error states, lint, typecheck, tests, and production build must be complete. Portable packages must not import Next.js, React, Expo, React Native, DOM, or Node-only APIs.
