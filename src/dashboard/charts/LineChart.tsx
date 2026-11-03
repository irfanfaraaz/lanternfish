import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SeriesPoint } from "../../shared/types";
import { longDay, num, shortDay } from "../format";

const H = 240;
const PAD_TOP = 20;
const PAD_BOTTOM = 26;
/** Left gutter for the y-axis labels, so a series never runs under them. */
const GUTTER = 40;

const motionOk = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: no-preference)").matches;

/**
 * The signature moment: the first time the chart has data, the views line is drawn like a pen
 * stroke and a nib rides its tip. Once per mount, only with motion allowed.
 */
function usePen(ready: boolean): [boolean, () => void] {
  const [pen, setPen] = useState(() => ready && motionOk());
  const started = useRef(pen);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (motionOk()) setPen(true);
  }, [ready]);
  return [pen, () => setPen(false)];
}

/** Ease-out matching the CSS curve cubic-bezier(.22, 1, .36, 1) closely enough for a pen stroke. */
const easeOut = (p: number) => 1 - (1 - p) ** 4;
const DRAW_MS = 900;

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

/**
 * Views (navy, filled), visitors (ink) and the previous period's views (dashed).
 * Hover or arrow keys move a readout along the points.
 */
export function LineChart({ series, prev, hourly }: { series: SeriesPoint[]; prev?: SeriesPoint[] | undefined; hourly: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = series.length;
  const max = niceMax(Math.max(1, ...series.map((p) => p.views), ...(prev ?? []).map((p) => p.views)));
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const plotW = w - GUTTER;
  const x = (i: number) => GUTTER + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_TOP + innerH - (v / max) * innerH;
  const path = (pts: SeriesPoint[], key: "views" | "uniques") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const area = `${path(series, "views")}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const label = (t: string) => (hourly ? t : shortDay(t));
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 90))));
  const ticks = [0, max / 2, max];
  const cur = idx === null ? null : series[idx];
  const prevPt = idx === null ? undefined : prev?.[idx];
  const total = series.reduce((a, p) => a + p.views, 0);
  const [pen, penDone] = usePen(n > 0);
  const line = useRef<SVGPathElement>(null);
  const nib = useRef<SVGCircleElement>(null);
  useLayoutEffect(() => {
    // One loop draws the stroke and places the nib in the same frame, so the two never drift.
    const l = line.current;
    const c = nib.current;
    if (!pen || !l || !c) return;
    const len = l.getTotalLength();
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = easeOut(Math.min(1, (now - t0) / DRAW_MS));
      l.style.strokeDasharray = `${len} ${len}`;
      l.style.strokeDashoffset = String((1 - e) * len);
      const pt = l.getPointAtLength(e * len);
      c.setAttribute("cx", pt.x.toFixed(1));
      c.setAttribute("cy", pt.y.toFixed(1));
      if (e < 1) raf = requestAnimationFrame(tick);
      else setTimeout(penDone, 260);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      l.style.strokeDasharray = "";
      l.style.strokeDashoffset = "";
    };
  }, [pen]);

  const onMove = (e: MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - GUTTER) / plotW) * (n - 1));
    setIdx(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setIdx((i) => Math.min(n - 1, Math.max(0, (i ?? (e.key === "ArrowRight" ? -1 : n)) + (e.key === "ArrowRight" ? 1 : -1))));
    }
    if (e.key === "Escape") setIdx(null);
  };

  return (
    <div class={`chart${pen ? " inking" : ""}`} ref={box}>
      <div class="readout" aria-live="polite">
        {cur ? (
          <>
            <span>
              <span class="k">{hourly ? "Hour" : "Day"}</span>
              {hourly ? cur.t : longDay(cur.t)}
            </span>
            <span>
              <span class="k">Views</span>
              {num(cur.views)}
            </span>
            <span>
              <span class="k">Visitors</span>
              {num(cur.uniques)}
            </span>
            {prevPt && (
              <span>
                <span class="k">Previous</span>
                {num(prevPt.views)}
              </span>
            )}
          </>
        ) : (
          <>
            <span class="legend">
              <i /> Views
            </span>
            <span class="legend">
              <i class="uniq" /> Visitors
            </span>
            {prev && (
              <span class="legend">
                <i class="prev" /> Previous period
              </span>
            )}
          </>
        )}
      </div>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`Views over time: ${num(total)} in total. Use the arrow keys to read each ${hourly ? "hour" : "day"}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setIdx(null)}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            {t > 0 && <line class="grid-line" x1={GUTTER} x2={w} y1={y(t)} y2={y(t)} />}
            <text class="axis" x={GUTTER - 8} y={y(t) + 4} text-anchor="end">
              {num(t)}
            </text>
          </g>
        ))}
        {n > 0 && <path class="area" d={area} />}
        {prev && prev.length === n && <path class="line-prev" d={path(prev, "views")} />}
        <path class="line-uniq" d={path(series, "uniques")} pathLength={1} />
        <path ref={line} class="line-cur" d={path(series, "views")} />
        {pen && <circle ref={nib} class="nib" r={4} cx={x(0)} cy={y(series[0]?.views ?? 0)} aria-hidden="true" />}
        <line class="baseline" x1={GUTTER} x2={w} y1={y(0) + 0.5} y2={y(0) + 0.5} />
        {series.map((p, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={p.t} class="axis" x={x(i)} y={H - 6} text-anchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {label(p.t)}
            </text>
          ) : null,
        )}
        {cur && idx !== null && (
          <g>
            <line class="hair" x1={x(idx)} x2={x(idx)} y1={PAD_TOP} y2={y(0)} />
            <circle class="dot" cx={x(idx)} cy={y(cur.views)} r={4.5} />
          </g>
        )}
      </svg>
    </div>
  );
}
