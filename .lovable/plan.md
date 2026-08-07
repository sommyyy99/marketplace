# Restore the white preview

## What I verified

- The Vite server starts normally and reports no compile/runtime failure.
- The app renders at the current `394 × 639` mobile viewport: the header, delivery scene, navigation, and content are visible.
- The signed-out browser run has one mounted app root and no console or page errors.
- This project uses an external Supabase project, so the preview's signed-in session cannot be injected into an automated browser here.

## Plan

1. **Make startup failure-safe**
   - Replace the current optimistic auth startup with a guarded initialization path that always finishes, even if session restoration or profile loading fails.
   - Keep the public storefront visible when authentication data cannot be restored instead of allowing auth state to block or destabilize rendering.

2. **Strengthen visible crash recovery**
   - Extend the existing error boundary so authenticated dashboard/profile failures show a compact recovery screen rather than white output.
   - Add a “continue signed out” recovery action that clears only the local Supabase session and reloads the storefront; keep the normal reload action too.
   - Capture early startup failures that occur before React can render the existing boundary.

3. **Harden authenticated-only data shapes**
   - Normalize profile role/name values before they control the dashboard branch.
   - Keep the dashboard behind a fully validated vendor session and fall back to the home view for stale or incomplete profile/vendor records.

4. **Verify the result**
   - Run the app at the current mobile viewport and a desktop viewport.
   - Confirm the signed-out storefront remains visible with no console errors.
   - Simulate auth/profile failures and confirm they produce a recoverable screen or public storefront, never a blank page.

## Technical note

No database changes are needed. The fix is limited to frontend auth initialization, authenticated-view guards, and error recovery.