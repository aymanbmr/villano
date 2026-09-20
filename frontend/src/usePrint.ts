import { useCallback, useEffect, useState } from 'react';
import type { PrintJob } from './components/PrintTicket';

// Renders a ticket into the page, opens the browser print dialog, then
// clears it. Only the ticket is visible under @media print (index.css).
export function usePrint() {
  const [job, setJob] = useState<PrintJob | null>(null);

  useEffect(() => {
    if (!job) return;
    const done = () => setJob(null);
    window.addEventListener('afterprint', done);
    // Wait one frame so the ticket is in the DOM before printing
    const id = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', done);
    };
  }, [job]);

  const print = useCallback((next: PrintJob) => setJob(next), []);
  return { job, print };
}
