export interface HBarDatum {
  label: string;
  value: number;
  sub?: string; // secondary text after the label (e.g. "12 vendus")
}

interface Props {
  data: HBarDatum[];
  format: (v: number) => string;
  color?: string;
  empty?: string;
}

// Ranked horizontal bars with direct labels: the honest form for "top N".
export function HBars({ data, format, color = 'var(--chart-1)', empty = 'Aucune donnée' }: Props) {
  if (data.length === 0) return <p className="chart-empty">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ol className="hbars">
      {data.map((d, i) => (
        <li key={i} className="hbar">
          <div className="hbar-head">
            <span className="hbar-label">
              <span className="hbar-rank">{i + 1}</span>
              {d.label}
              {d.sub && <span className="hbar-sub"> · {d.sub}</span>}
            </span>
            <span className="hbar-value">{format(d.value)}</span>
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
