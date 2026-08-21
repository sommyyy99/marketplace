# Fix the stuck reconnect screen

## What I verified

- The screenshot is the static startup shell from `index.html`, not the React application.
- `main.tsx` removes that shell immediately when its module executes, so the shell remaining means the entry module did not successfully start.
- No React runtime error was captured, and the current HTML has only a direct module script with no failure handler or controlled retry.

## Plan

1. **Replace the fragile direct startup handoff**
   - Load the React entry through a small inline module bootstrap that can detect a failed module import.
   - Keep the existing shell visible only while the first load is genuinely in progress.

2. **Recover without reload loops**
   - Retry the module import on a short, capped schedule and when the browser comes back online or the tab becomes visible.
   - Mount React as soon as Vite is reachable again, without repeatedly reloading the whole preview.
   - After retries are exhausted, change the shell to a clear failure state with a manual retry button instead of animating forever.

3. **Keep React recovery separate**
   - Preserve the existing error boundary and signed-out recovery for errors that happen after React starts.
   - Ensure startup listeners do not replace an already-rendered app.

4. **Verify the exact paths**
   - Confirm a normal load replaces the shell with Sommygo.
   - Simulate an unavailable entry module, restore it, and confirm the app mounts automatically.
   - Confirm retries stop at the cap and do not create a reload loop.
