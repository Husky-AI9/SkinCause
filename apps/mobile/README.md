# SkinCause Android demo

This Expo Router client uses the same `/api/v1` contract, domain helpers, and Supabase-backed session model as the web app. It never imports server-core or provider code.

1. From the repository root, run `npx.cmd pnpm@10.14.0 install`. This updates `pnpm-lock.yaml`; commit that file before a Vercel deployment.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the deployed Vercel API (or use the Android emulator fallback `http://10.0.2.2:3000/api/v1`). Also set the public Supabase URL and anonymous key for the disposable demo account.
3. Start an Android emulator in Android Studio.
4. From the repository root, run `npm.cmd run mobile:android`.

The demo can create an anonymous Supabase session when the public Supabase variables are configured. Its bottom navigation mirrors the web product: Acne plan, Scan, Experiment, and Products.

The Android demo includes:

- the acne-visible prepared demo portrait plus camera/gallery capture;
- resumable YouCam scan tasks with normalized results persisted into Acne plan;
- affordable AI product guidance with verified product links and quantified food servings;
- YouCam skin simulation that appears only after generation;
- a draggable, accessible before/after comparison;
- routine product pause/restart controls; and
- account/demo deletion from Acne plan, with no separate Privacy screen.
