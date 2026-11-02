import { type ComponentChildren, Fragment } from "preact";
import { useState } from "preact/hooks";
import type { Row } from "../../shared/types";
import { num, pct } from "../format";
import { Funnel } from "../icons";

interface Props {
  rows: Row[];
  /** Denominator for the percentage column. */
  total: number;
  label?: (key: string) => ComponentChildren;
  /** Clicking a row filters the page by its value. */
  onPick?: ((key: string) => void) | undefined;
  limit?: number;
  empty: ComponentChildren;
  /** Extra content under a row, such as event props. */
  detail?: (key: string) => ComponentChildren;
}

/**
 * Ranked rows with an ink bar under each, its length the share of the top row.
 * With `onPick`, the whole row is a 44px button that filters the page, and says so on hover and focus.
 */
export function BarList({ rows, total, label, onPick, limit = 8, empty, detail }: Props) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p class="empty">{empty}</p>;
  const max = rows[0]!.value || 1;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
      <ul class={`bars${onPick ? " pickable" : ""}`}>
        {shown.map((r) => {
          const name = label ? label(r.key) : r.key || "(none)";
          const inner = (
            <>
              <span class="key">{name}</span>
              <span class="val">{num(r.value)}</span>
              <span class="pct">{pct(r.value, total)}</span>
              <span class="bar" aria-hidden="true" />
            </>
          );
          return (
            <Fragment key={r.key}>
              <li style={{ "--w": String(r.value / max) }}>
                {onPick ? (
                  <button type="button" class="row" onClick={() => onPick(r.key)} aria-label={`Filter by ${r.key || "(none)"}: ${num(r.value)}, ${pct(r.value, total)}`}>
                    {inner}
                    <span class="pick" aria-hidden="true">
                      <Funnel />
                    </span>
                  </button>
                ) : (
                  <div class="row static" title={r.key}>
                    {inner}
                  </div>
                )}
              </li>
              {detail?.(r.key)}
            </Fragment>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button type="button" class="more" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
