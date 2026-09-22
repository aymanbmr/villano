import { Icon } from '../Icon';

interface Props {
  label: string;
  value: string;
  // Change versus the previous period, as a ratio (0.12 = +12 %); null when no baseline
  delta?: number | null;
  hint?: string;
}

export function StatTile({ label, value, delta, hint }: Props) {
  const dir = delta == null ? null : delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'flat';
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {dir && (
        <div className={`stat-delta is-${dir}`}>
          {dir !== 'flat' && <Icon name={dir === 'up' ? 'up' : 'down'} size={13} />}
          {Math.abs((delta ?? 0) * 100).toFixed(0)} %
          <span className="stat-hint"> vs période précédente</span>
        </div>
      )}
      {!dir && hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
