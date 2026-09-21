import { useState } from 'react';
import { useWidth } from './useWidth';

export interface BarDatum {
  label: string; // x-axis label (e.g. "12/09" or "14h")
  value: number;
  title?: string; // tooltip title (defaults to label)
  detail?: string; // tooltip second line
}

interface Props {
  data: BarDatum[];
  format: (v: number) => string;
  height?: number;
  color?: string;
  // Show every n-th x label (1 = all)
  labelEvery?: number;
}

const PAD = { top: 12, right: 8, bottom: 24, left: 44 };
const MAX_BAR = 24;

// Single-series column chart: thin bars, 4px rounded top, square baseline,
// hairline gridlines, per-bar hover tooltip.
export function BarChart({ data, format, height = 200, color = 'var(--chart-1)', labelEvery }: Props) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = niceCeil(max);
  const ticks = [0, niceMax / 2, niceMax];
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.min(MAX_BAR, Math.max(2, slot - 2));
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 44))));
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Graphique en barres">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const h = Math.max(0, (d.value / niceMax) * innerH);
            const top = PAD.top + innerH - h;
            const r = Math.min(4, h);
            const path =
              h <= 0
                ? ''
                : `M${x},${PAD.top + innerH} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`;
            return (
              <g key={i}>
                {/* hit target wider than the bar */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                {path && (
                  <path d={path} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} style={{ pointerEvents: 'none' }} />
                )}
                {i % every === 0 && (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="chart-tick">
                    {d.label}
                  </text>
                )}
                {hover === i && (
                  <line x1={x + barW / 2} x2={x + barW / 2} y1={PAD.top} y2={top} className="chart-crosshair" />
                )}
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="chart-axis" />
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(width - 150, Math.max(0, PAD.left + hover * slot + slot / 2 - 70)),
            top: 0,
          }}
        >
          <div className="chart-tooltip-title">{data[hover].title ?? data[hover].label}</div>
          <div className="chart-tooltip-value">{format(data[hover].value)}</div>
          {data[hover].detail && <div className="chart-tooltip-detail">{data[hover].detail}</div>}
        </div>
      )}
    </div>
  );
}

function niceCeil(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

function compact(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}
