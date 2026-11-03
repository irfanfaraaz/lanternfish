import { useState } from "preact/hooks";
import type { FilterDim, Site, Stats } from "../../shared/types";
import { useApi } from "../api";
import { BarList } from "../charts/BarList";
import { Funnel } from "../charts/Funnel";
import { LineChart } from "../charts/LineChart";
import { FilterBar } from "../components/FilterBar";
import { RangePicker } from "../components/RangePicker";
import { Shell } from "../components/Shell";
import { Band, ErrorLine, Odometer, Section, Skeleton, Stamp } from "../components/ui";
import { change, countryName, duration, num, pct, signedPct } from "../format";
import { statsQuery, useView } from "../state";

type Me = { retentionDays: number };

function Figure({ label, value, cur, prev, lowerIsBetter = false }: { label: string; value: string; cur: number; prev?: number | undefined; lowerIsBetter?: boolean }) {
  const c = change(cur, prev);
  const good = c !== null && (lowerIsBetter ? c < 0 : c > 0);
  const cls = c === null || Math.round(c * 100) === 0 ? "" : good ? "up" : "down";
  return (
    <div class="figure tile span-3">
      <span class="label">{label}</span>
      <Odometer class="value" value={value} />
      <span class={`delta ${cls}`}>{c === null ? (prev === undefined ? " " : "No earlier data") : `${signedPct(c)} vs previous`}</span>
    </div>
  );
}

const THRESHOLDS = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] } as const;

function Vital({ metric, value }: { metric: keyof typeof THRESHOLDS; value: number | undefined }) {
  if (value === undefined) return <td class="r">—</td>;
  const [good, poor] = THRESHOLDS[metric];
  const rating = value <= good ? "good" : value <= poor ? "warn" : "bad";
  const words = { good: "good", warn: "needs work", bad: "poor" }[rating];
  return (
    <td class="r">
      <span class={`rating ${rating}`} title={words}>
        {metric === "cls" ? value.toFixed(2) : num(Math.round(value))}
      </span>
      <span class="sr-only"> ({words})</span>
    </td>
  );
}


function Agents({ rows }: { rows: Stats["agents"] }) {
  const [all, setAll] = useState(false);
  const LIMIT = 8;
  const shown = all ? rows.slice(0, 50) : rows.slice(0, LIMIT);
  return (
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th scope="col">Path</th>
            <th scope="col" class="r">
              Fetches
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((a) => (
            <tr key={`${a.bot} ${a.path}`}>
              <td>{a.bot}</td>
              <td class="path" title={a.path}>
                <code>{a.path}</code>
              </td>
              <td class="r">{num(a.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > LIMIT && (
        <button type="button" class="more" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${Math.min(rows.length, 50)}`}
        </button>
      )}
    </div>
  );
}

export function Overview({ id, shareMode = false }: { id: string; shareMode?: boolean }) {
  const site = useApi<Site>(`/sites/${id}`);
  const me = useApi<Me>("/me");
  const tz = site.data?.timezone ?? "UTC";
  const v = useView(tz);
  const stats = useApi<Stats>(site.data ? `/sites/${id}/stats?${statsQuery(v.view)}` : null);
  const s = stats.data;
  const pick = (dim: FilterDim) => (key: string) => v.addFilter(dim, key);
  const t = s?.totals;
  const p = s?.prevTotals;
  const hourly = v.view.range.from === v.view.range.to;

  return (
    <Shell siteId={shareMode ? undefined : id}>
      <div class="head">
        <div class="head-title">
          <h1>{site.data?.name ?? " "}</h1>
          <p class="sub">{site.data ? `${site.data.domains.join(", ")} · ${tz}` : " "}</p>
        </div>
        <div class="head-actions">
          <RangePicker
            preset={v.view.preset}
            from={v.view.range.from}
            to={v.view.range.to}
            today={v.today}
            compare={v.view.compare}
            onPreset={v.setPreset}
            onCustom={v.setCustom}
            onCompare={v.setCompare}
          />
        </div>
      </div>

      {site.error && <ErrorLine message={site.error} retry={site.reload} />}
      {stats.error && <ErrorLine message={stats.error} retry={stats.reload} />}

      <FilterBar filters={v.view.filters} onRemove={v.removeFilter} retention={me.data?.retentionDays ?? 90} />

      <div class="grid figures" aria-busy={stats.loading}>
        {t ? (
          <>
            <Figure label="Views" value={num(t.views)} cur={t.views} prev={p?.views} />
            <Figure label="Visitors" value={num(t.uniques)} cur={t.uniques} prev={p?.uniques} />
            <Figure label="Median time on page" value={duration(t.visibleMsP50)} cur={t.visibleMsP50} prev={p?.visibleMsP50} />
            <Figure
              label="Bounce rate"
              value={pct(t.bounces, t.loads)}
              cur={t.loads ? t.bounces / t.loads : 0}
              prev={p && p.loads ? p.bounces / p.loads : undefined}
              lowerIsBetter
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => (
            <div class="figure tile span-3" key={i}>
              <Skeleton lines={2} />
            </div>
          ))
        )}
      </div>

      <div class="chart-card panel">{s ? <LineChart series={s.series} prev={s.prevSeries} hourly={hourly} /> : <Skeleton lines={6} />}</div>

      {s && (
        <>
          <Band title="Traffic" id="band-traffic">
            <Section title="Pages" meta="Views" level={3}>
              <BarList rows={s.pages} total={t!.views} onPick={pick("path")} empty="No page views in this range." />
            </Section>
            <Section title="Referrers" meta="Views" level={3}>
              <BarList rows={s.refs} total={t!.views} onPick={pick("ref")} empty="No referrers yet. Direct visits and private links don't send one." />
            </Section>
            <Section title="Link tags" meta="?ref= and utm_source" level={3}>
              <BarList
                rows={s.tags}
                total={t!.views}
                onPick={pick("tag")}
                empty={
                  <>
                    Add <code>?ref=newsletter</code> to a link you share and its visits are counted here.
                  </>
                }
              />
            </Section>
            <Section title="Countries" meta="Views" level={3}>
              <BarList rows={s.countries} total={t!.views} label={(k) => countryName(k)} onPick={pick("country")} empty="No location data in this range." />
            </Section>
          </Band>

          <Band title="Audience" id="band-audience">
            <Section title="Devices" span={4} level={3}>
              <BarList rows={s.devices} total={t!.views} label={(k) => k[0]!.toUpperCase() + k.slice(1)} onPick={pick("device")} empty="No data." limit={5} />
            </Section>
            <Section title="Browsers" span={4} level={3}>
              <BarList rows={s.browsers} total={t!.views} onPick={pick("browser")} empty="No data." limit={5} />
            </Section>
            <Section title="Operating systems" span={4} level={3}>
              <BarList rows={s.os} total={t!.views} onPick={pick("os")} empty="No data." limit={5} />
            </Section>
          </Band>

          <Band title="Behaviour and health" id="band-behaviour">
            <Section title="Sections" span={12} level={3} meta={s.funnel.length ? "Share of page loads that reached each section" : undefined}>
              {s.funnel.length ? (
                <Funnel steps={s.funnel} loads={t!.loads} />
              ) : (
                <p class="empty">
                  Mark sections with <code>data-lf-section="name"</code>, then list them in order under Settings to see how far people read.
                </p>
              )}
            </Section>

            <Section title="Custom events" meta="Count" level={3}>
              <BarList
                rows={s.events}
                total={s.events.reduce((a, r) => a + r.value, 0)}
                onPick={pick("event")}
                empty={
                  <>
                    Add <code>data-lf-click="name"</code> to a button, or call <code>lf("name")</code>.
                  </>
                }
                detail={(name) => {
                  const props = s.eventProps[name];
                  if (!props) return null;
                  return (
                    <li class="props">
                      {Object.entries(props).map(([key, rows]) => (
                        <div key={key}>
                          <span class="label">{key}</span>
                          <BarList rows={rows} total={rows.reduce((a, r) => a + r.value, 0)} empty="" limit={4} />
                        </div>
                      ))}
                    </li>
                  );
                }}
              />
            </Section>
            <Section title="Outbound links" meta="Clicks" level={3}>
              <BarList rows={s.outbound} total={s.outbound.reduce((a, r) => a + r.value, 0)} empty="No clicks to other sites yet." />
            </Section>

            <Section title="Core Web Vitals" meta="75th percentile" level={3}>
              {s.vitals.length ? (
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th scope="col">Page</th>
                        <th scope="col" class="r">
                          LCP <span class="unit">ms</span>
                        </th>
                        <th scope="col" class="r">
                          INP <span class="unit">ms</span>
                        </th>
                        <th scope="col" class="r">
                          CLS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.vitals.slice(0, 12).map((x) => (
                        <tr key={x.path}>
                          <td class="path" title={x.path}>
                            {x.path}
                          </td>
                          <Vital metric="lcp" value={x.lcp} />
                          <Vital metric="inp" value={x.inp} />
                          <Vital metric="cls" value={x.cls} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p class="vitals-key" aria-hidden="true">
                    <Stamp tone="good">Good</Stamp>
                    <Stamp tone="wait">Needs work</Stamp>
                    <Stamp tone="bad">Poor</Stamp>
                  </p>
                </div>
              ) : (
                <p class="empty">Vitals arrive when visitors leave a page. Check back after some traffic.</p>
              )}
            </Section>
            <Section title="Not found" meta="404 views" level={3}>
              <BarList
                rows={s.notFound}
                total={s.notFound.reduce((a, r) => a + r.value, 0)}
                empty={
                  <>
                    Set <code>data-lf-404</code> on your 404 page's <code>&lt;html&gt;</code> to list broken links here.
                  </>
                }
              />
            </Section>

            <Section title="AI agents and crawlers" meta="Fetches" span={12} level={3}>
              {s.agents.length ? <Agents rows={s.agents} /> : <p class="empty">Bots don't run JavaScript. Add the server snippet from Settings to log GPTBot, ClaudeBot and others.</p>}
            </Section>
          </Band>

          <footer class="page-foot">
            <div class="about">
              <h2>About these numbers</h2>
              <p>
                Visitors are counted per day from a salted hash that rotates at midnight UTC, so one person on two days counts twice. Time on page is the median time a page was
                visible. Medians and percentiles over several days are averages of each day's value. No cookies, no stored IP addresses.
              </p>
            </div>
            {!shareMode && (
              <p class="keys-hint">
                Keys: <kbd>1</kbd>–<kbd>4</kbd> range, <kbd>g</kbd> <kbd>o</kbd> / <kbd>r</kbd> / <kbd>s</kbd> tabs. Click any row to filter by it.
              </p>
            )}
          </footer>
        </>
      )}
    </Shell>
  );
}
