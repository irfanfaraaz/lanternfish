import { PRESETS, type Preset } from "../state";

interface Props {
  preset: Preset;
  from: string;
  to: string;
  today: string;
  compare: boolean;
  onPreset: (id: Exclude<Preset, "custom">) => void;
  onCustom: (from: string, to: string) => void;
  onCompare: (on: boolean) => void;
}

export function RangePicker({ preset, from, to, today, compare, onPreset, onCustom, onCompare }: Props) {
  return (
    <>
      <div class="seg" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => onPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <label class="sr-only" for="lf-from">
        From
      </label>
      <input
        id="lf-from"
        class="date"
        type="date"
        value={from}
        max={to}
        aria-label="From"
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v) onCustom(v, to < v ? v : to);
        }}
      />
      <input
        class="date"
        type="date"
        value={to}
        min={from}
        max={today}
        aria-label="To"
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v) onCustom(from > v ? v : from, v);
        }}
      />
      <label class="check">
        <input type="checkbox" checked={compare} onChange={(e) => onCompare((e.target as HTMLInputElement).checked)} />
        Compare
      </label>
    </>
  );
}
