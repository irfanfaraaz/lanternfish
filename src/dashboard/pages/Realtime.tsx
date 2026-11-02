import { useEffect, useRef, useState } from "preact/hooks";
import type { Realtime as RT, Site } from "../../shared/types";
import { useApi } from "../api";
import { BarList } from "../charts/BarList";
import { Shell } from "../components/Shell";
import { ErrorLine, Odometer, Section, Stamp } from "../components/ui";
import { DoodleFish } from "../icons";

const WINDOW_MS = 30 * 60_000;

/** "just now" · "12s ago" · "3m ago" */
function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/** The readings taken while this tab has been open, at most the last 30 minutes. No new endpoint: it is this page's own memory. */
function useReadings(n: number | undefined, stamp: number) {
  const [list, setList] = useState<{ t: number; n: number }[]>([]);
  useEffect(() => {
    if (n === undefined || !stamp) return;
    setList((l) => [...l.filter((r) => stamp - r.t < WINDOW_MS), { t: stamp, n }]);
  }, [stamp]);
  return list;
}

/** Its own one-second clock, so only this line re-renders. */
function Fresh({ at, loading }: { at: number; loading: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <p class="fresh">{at ? `Updated ${ago(now - at)}` : loading ? "Reading…" : " "}</p>;
}

function Trail({ readings }: { readings: { t: number; n: number }[] }) {
  if (readings.length < 2) return <p class="trail-note">The trail of readings fills in as this page stays open.</p>;
  const t0 = readings[0]!.t;
  const span = Math.max(1, readings[readings.length - 1]!.t - t0);
  const max = Math.max(1, ...readings.map((r) => r.n));
  const pts = readings.map((r) => `${(((r.t - t0) / span) * 100).toFixed(2)},${(30 - (r.n / max) * 26).toFixed(2)}`).join(" ");
  const mins = Math.max(1, Math.round(span / 60_000));
  return (
    <figure class="trail">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="31" x2="100" y2="31" />
        <polyline points={pts} />
      </svg>
      <figcaption>
        {readings.length} readings over the last <span class="n">{mins}</span> {mins === 1 ? "minute" : "minutes"}, peak <span class="n">{max}</span>
      </figcaption>
    </figure>
  );
}

export function Realtime({ id }: { id: string }) {
  const site = useApi<Site>(`/sites/${id}`);
  const live = useApi<RT>(`/sites/${id}/realtime`, 30_000);
  const n = live.data?.visitors;

  // When the last answer arrived, and a clock that ticks so "updated 12s ago" stays true.
  const [at, setAt] = useState(0);
  const last = useRef<RT>();
  useEffect(() => {
    if (live.data && live.data !== last.current) {
      last.current = live.data;
      setAt(Date.now());
    }
  }, [live.data]);
  const readings = useReadings(n, at);

  return (
    <Shell siteId={id}>
      <div class="head">
        <div class="head-title">
          <h1>{site.data?.name ?? " "}</h1>
          <p class="sub">Visitors in the last five minutes. Updates every 30 seconds while this tab is open.</p>
        </div>
      </div>
      {live.error && <ErrorLine message={live.error} retry={live.reload} />}
      <div class="grid cards live-grid">
        <section class="card live-card span-5" aria-labelledby="h-now">
          <header class="live-head">
            <h2 id="h-now">Right now</h2>
            <Stamp tone="primary">
              <span class="pulse" aria-hidden="true" />
              Live
            </Stamp>
          </header>
          <div class="live-count" aria-live="polite" aria-atomic="true">
            {n === undefined ? <span class="n">–</span> : <Odometer value={String(n)} />}
            <span class="live-unit">{n === 1 ? "visitor" : "visitors"}</span>
          </div>
          <Fresh at={at} loading={live.loading} />
          <Trail readings={readings} />
        </section>
        <Section title="Active pages" meta="Visitors" span={7}>
          {n === 0 ? (
            <div class="empty-doodle">
              <DoodleFish />
              <p class="empty">Nobody's here right now. Share a link and watch this fill in.</p>
            </div>
          ) : (
            <BarList rows={live.data?.pages ?? []} total={n ?? 0} empty="Nobody's here right now. Share a link and watch this fill in." />
          )}
        </Section>
      </div>
    </Shell>
  );
}
