import { useEffect, useState } from "preact/hooks";
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

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Presets, a Custom segment that reveals the two dates, and Compare. Keys 1 to 4 pick a preset. */
export function RangePicker({ preset, from, to, today, compare, onPreset, onCustom, onCompare }: Props) {
  const [open, setOpen] = useState(preset === "custom");
  const custom = preset === "custom" || open;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const p = PRESETS[Number(e.key) - 1];
      if (p) {
        e.preventDefault();
        setOpen(false);
        onPreset(p.id);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onPreset]);

  return (
    <div class="range">
      <div class="seg" role="group" aria-label="Date range">
        {PRESETS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={!custom && preset === p.id}
            aria-keyshortcuts={String(i + 1)}
            title={`${p.label} (${i + 1})`}
            onClick={() => {
              setOpen(false);
              onPreset(p.id);
            }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} aria-expanded={custom} aria-controls="lf-dates" onClick={() => setOpen(true)}>
          Custom
        </button>
      </div>
      {custom && (
        <div class="dates" id="lf-dates" role="group" aria-label="Custom range">
          <input
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
          <span class="dash" aria-hidden="true">
            –
          </span>
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
        </div>
      )}
      <label class="check">
        <input type="checkbox" checked={compare} onChange={(e) => onCompare((e.target as HTMLInputElement).checked)} />
        Compare
      </label>
    </div>
  );
}
