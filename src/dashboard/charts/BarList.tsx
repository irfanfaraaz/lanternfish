import { type ComponentChildren, Fragment } from "preact";
import { useState } from "preact/hooks";
import type { Row } from "../../shared/types";
import { num, pct } from "../format";

interface Props {
  rows: Row[];
  /** Denominator for the percentage column. */
  total: number;
  label?: (key: string) => ComponentChildren;
  /** Clicking a value filters the page by it. */
  onPick?: ((key: string) => void) | undefined;
  limit?: number;
  empty: ComponentChildren;
  /** Extra content under a row, such as event props. */
  detail?: (key: string) => ComponentChildren;
}

/** Ranked rows with a thin red rule under each, its length the share of the top row. */
export function BarList({ rows, total, label, onPick, limit = 8, empty, detail }: Props) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p class="empty">{empty}</p>;
  const max = rows[0]!.value || 1;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
      <ul class="bars">
        {shown.map((r) => (
          <Fragment key={r.key}>
            <li style={{ "--w": `${(r.value / max) * 100}%` }}>
              {onPick ? (
                <button type="button" class="key" title={`Filter by ${r.key || "(none)"}`} onClick={() => onPick(r.key)}>
                  {label ? label(r.key) : r.key || "(none)"}
                </button>
              ) : (
                <span class="key static" title={r.key}>
                  {label ? label(r.key) : r.key || "(none)"}
                </span>
              )}
              <span class="val">{num(r.value)}</span>
              <span class="pct">{pct(r.value, total)}</span>
            </li>
            {detail?.(r.key)}
          </Fragment>
        ))}
      </ul>
      {rows.length > limit && (
        <button type="button" class="more" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
