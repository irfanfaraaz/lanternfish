import { num, pct } from "../format";

/** Each configured section's reach as a share of page loads, with the drop from the step before. */
export function Funnel({ steps, loads }: { steps: { section: string; loads: number }[]; loads: number }) {
  const base = Math.max(loads, steps[0]?.loads ?? 0, 1);
  return (
    <ol class="funnel">
      {steps.map((s, i) => {
        const before = i === 0 ? base : steps[i - 1]!.loads;
        const drop = before ? 1 - s.loads / before : 0;
        return (
          <li key={s.section}>
            <code>{s.section}</code>
            <span class="track" role="img" aria-label={`${s.section}: ${pct(s.loads, base)} of page loads`}>
              <span style={{ width: `${Math.min(100, (s.loads / base) * 100)}%` }} />
            </span>
            <span class="num">{num(s.loads)}</span>
            <span class="drop">{i === 0 ? pct(s.loads, base) : drop > 0 ? `−${Math.round(drop * 100)}%` : "—"}</span>
          </li>
        );
      })}
    </ol>
  );
}
