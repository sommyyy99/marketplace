# Prevent the preview from going white during restarts

## Verified cause

- At 08:36:42, the preview environment changed and Vite restarted.
- The in-flight build was canceled during that restart, matching the browser's “server connection lost” message.
- The server has recovered and currently returns HTTP 200.
- No React runtime error was captured, so this occurrence is a dev-server restart window rather than the authenticated render crash addressed previously.

## Plan

1. **Render a startup shell before React loads**
   - Put a lightweight branded reconnect/loading state directly in the app root so a canceled or delayed JavaScript build never leaves an empty white document.
   - Include a manual reload action for unusually long restarts.

2. **Integrate it with existing recovery handling**
   - Mark the startup shell explicitly so `main.tsx` can replace it with either the React app or the existing actionable recovery screen.
   - Ensure startup errors are not ignored merely because the shell is present.

3. **Verify the actual failure mode**
   - Confirm normal app rendering replaces the shell.
   - Simulate a delayed/failed module load and confirm the reconnect state remains visible instead of a white page.
   - Check the preview at the current viewport with no new console errors.

## Scope

Frontend startup and recovery only; no database, authentication, or business-logic changes.