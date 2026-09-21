import { PRESETS, presetRange, type Preset } from './dateRange';

export interface Range {
  from: string;
  to: string;
  preset: Preset;
}

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

// Preset chips + two date inputs, shared by dashboard and history
export function RangePicker({ value, onChange }: Props) {
  return (
    <div className="range-picker">
      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${value.preset === p.id ? ' is-active' : ''}`}
            onClick={() => onChange({ ...presetRange(p.id), preset: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="range-dates">
        <input
          type="date"
          className="input input-date"
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value, preset: 'custom' })}
        />
        <span className="muted">→</span>
        <input
          type="date"
          className="input input-date"
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value, preset: 'custom' })}
        />
      </div>
    </div>
  );
}

export const defaultRange = (): Range => ({ ...presetRange('today'), preset: 'today' });
