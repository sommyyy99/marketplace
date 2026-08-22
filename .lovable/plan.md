# Make the reconnect screen recover automatically

## Verified cause

- At 11:25 UTC, an environment change restarted Vite and canceled the in-flight build.
- During that window, both `/` and `/src/main.tsx` refused connections, which left the browser showing the static Sommygo startup shell.
- Vite has since restarted successfully, but the current shell only offers a full manual reload; it cannot retry loading React after the server returns.

## Plan

1. **Replace the direct entry script with a controlled bootstrap**
   - Keep the Sommygo shell available immediately while the preview reconnects.
   - Import the React entry from a small inline module so startup failure can be detected before React executes.

2. **Retry the entry module without a reload loop**
   - Retry on a short, capped backoff and when the browser comes online or the tab becomes visible.
   - Import a fresh entry URL after Vite recovers, then let React replace the shell normally.
   - Stop all retry listeners as soon as the app mounts.

3. **Provide a real exhausted state**
   - After the retry cap, stop the moving progress indicator and explain that reconnection failed.
   - Keep one manual retry button that restarts the controlled import attempt rather than repeatedly reloading the whole page.

4. **Verify the restart path**
   - Confirm normal startup renders Sommygo immediately.
   - Simulate an unavailable entry module, restore it, and confirm the existing page mounts React automatically.
   - Confirm failed retries stop at the cap with no white screen and no reload loop.

## Scope

Frontend startup only. No authentication, database, or application-feature changes.
