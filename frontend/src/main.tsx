import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Surface render errors loudly instead of a silently blank screen
const onError = (error: unknown) => {
  console.error('[Villano] render error', error);
  const el = document.getElementById('root');
  if (el && !el.childElementCount) {
    el.innerHTML =
      '<div style="padding:24px;font-family:system-ui"><h2>Erreur d’affichage</h2><pre style="white-space:pre-wrap;color:#b91c1c"></pre></div>';
    el.querySelector('pre')!.textContent = error instanceof Error ? error.message : String(error);
  }
};

// Keeps the caisse loadable when the server is unreachable (production only:
// in dev, Vite already serves everything from memory).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(async () => {
      // Tell the worker about this build's files so a first-time visitor is
      // already covered if the server goes away before the next load.
      const urls = [
        ...document.querySelectorAll<HTMLScriptElement>('script[src]'),
      ].map((el) => el.src);
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
        if (link.href.startsWith(location.origin)) urls.push(link.href);
      }
      const worker = (await navigator.serviceWorker.ready).active;
      worker?.postMessage({ type: 'PRECACHE', urls });
    });
  });
}

createRoot(document.getElementById('root')!, {
  onUncaughtError: onError,
  onCaughtError: onError,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
