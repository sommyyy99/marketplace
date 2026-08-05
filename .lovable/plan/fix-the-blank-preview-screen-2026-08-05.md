# Fix the blank preview screen

## What I verified

- The dev server is healthy (HTTP 200) and the app renders correctly in a headless browser when signed out — hero, nav, vendors and menu items all appear, with no console or page errors.
- Your preview session is signed in as `vendortest@gmail.com` with `role = 'vendor'`, and its Supabase calls are all succeeding (vendors, menu_items, profiles all return 200 with data).
- All component imports resolve; nothing is missing on disk.

So the blank white screen only happens in your signed-in vendor session, while data loads fine. That points to a JavaScript error thrown during render — and right now the app has no error boundary, so any throw unmounts the whole page and leaves plain white with no message. I can't reproduce it directly because this project uses an external Supabase project, so no test session can be injected here.

## Plan

1. **Add an error boundary** wrapping the app in `src/main.tsx`, so a render crash shows a readable fallback card (message + reset button) instead of a white screen, and logs the error + component stack to the console.
2. **Harden the vendor/dashboard path**, the code that only runs in your session:
   - Vendor dashboard: tolerate missing `order_items`, a null `customer` join, and null/NaN money values instead of assuming shapes.
   - Home view: guard the same money/array assumptions in the basket and menu rendering.
3. **Re-verify**: reload the preview. If a crash is still happening, the boundary will now name the failing component and line, and I'll fix that root cause in a follow-up step rather than guessing.

## Notes

Step 1 is the piece that turns "blank screen, no information" into an actionable error every time this class of bug happens, so it stays regardless of what step 2 turns up. No database or backend changes are involved.
