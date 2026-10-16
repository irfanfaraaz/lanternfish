/** 30-day views as one red line. Decorative: the row already states the totals. */
export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i / n) * 100},${26 - (v / max) * 24}`).join(" ");
  return (
    <svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="27.5" x2="100" y2="27.5" stroke="var(--rule)" stroke-width="1" vector-effect="non-scaling-stroke" />
      <polyline points={pts} />
    </svg>
  );
}
