import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './integrations/supabase/client';
import './index.css';

const rootElement = document.getElementById('root');

function showStartupRecovery(error: unknown) {
  console.error('App startup failed:', error);
  if (!rootElement || rootElement.childElementCount > 0) return;

  const recovery = document.createElement('div');
  recovery.className = 'min-h-screen grid place-items-center bg-[#fdf8ec] px-4 py-10';
  recovery.innerHTML = `
    <div class="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-lg">
      <h1 class="mb-2 text-xl font-black text-[#111827]">The app could not start</h1>
      <p class="mb-4 text-sm text-[#667085]">Reload the preview, or clear this browser's saved session and continue signed out.</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <button data-reload class="min-h-[46px] rounded-full border border-[#1B5E3E] font-bold text-[#1B5E3E]">Reload</button>
        <button data-signout class="min-h-[46px] rounded-full bg-[#1B5E3E] font-bold text-white">Continue signed out</button>
      </div>
    </div>`;
  recovery.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
  recovery.querySelector('[data-signout]')?.addEventListener('click', async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutError) {
      console.error('Could not clear the local session:', signOutError);
    } finally {
      window.location.reload();
    }
  });
  rootElement.replaceChildren(recovery);
}

window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.message, e.filename, e.lineno);
  showStartupRecovery(e.error ?? new Error(e.message));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  showStartupRecovery(e.reason);
});

if (!rootElement) {
  throw new Error('The app root element is missing.');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  showStartupRecovery(error);
}
