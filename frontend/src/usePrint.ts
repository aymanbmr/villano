import { useCallback, useEffect, useState } from 'react';
import type { PrintJob } from './components/PrintTicket';

// Waits for every image of the ticket to be ready (never longer than a
// second, so a missing image can never block an order).
async function waitForImages() {
  const images = [...document.querySelectorAll<HTMLImageElement>('.ticket-print img')];
  await Promise.race([
    Promise.all(
      images.map((img) =>
        img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

// Renders a ticket into the page, opens the browser print dialog, then
// clears it. Only the ticket is visible under @media print (index.css).
export function usePrint() {
  const [job, setJob] = useState<PrintJob | null>(null);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const done = () => setJob(null);
    window.addEventListener('afterprint', done);

    // Print only once the ticket is in the DOM *and* its images are decoded:
    // printing too early produces a ticket without the logo.
    const run = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await waitForImages();
      if (!cancelled) window.print();
    };
    void run();

    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', done);
    };
  }, [job]);

  const print = useCallback((next: PrintJob) => setJob(next), []);
  return { job, print };
}
