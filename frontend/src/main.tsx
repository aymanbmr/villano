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

createRoot(document.getElementById('root')!, {
  onUncaughtError: onError,
  onCaughtError: onError,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
