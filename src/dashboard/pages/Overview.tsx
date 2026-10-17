import type { FilterDim, Site, Stats } from "../../shared/types";
import { useApi } from "../api";
import { BarList } from "../charts/BarList";
import { Funnel } from "../charts/Funnel";
import { LineChart } from "../charts/LineChart";
import { FilterBar } from "../components/FilterBar";
import { RangePicker } from "../components/RangePicker";
import { Shell } from "../components/Shell";
import { ErrorLine, Section, Skeleton } from "../components/ui";
import { change, countryName, duration, num, pct, signedPct } from "../format";
import { statsQuery, useView } from "../state";

type Me = { retentionDays: number };

function Figure({ label, value, cur, prev, lowerIsBetter = false }: { label: string; value: string; cur: number; prev?: number | undefined; lowerIsBetter?: boolean }) {
  const c = change(cur, prev);
  const good = c !== null && (lowerIsBetter ? c < 0 : c > 0);
  const cls = c === null || Math.round(c * 100) === 0 ? "" : good ? "up" : "down";
  return (
    <div class="figure span-3">
      <span class="label">{label}</span>
      <span class="value">{value}</span>
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
      <div class="head grid">
        <div class="span-5">
          <h1>{site.data?.name ?? " "}</h1>
          <p class="sub">{site.data ? `${site.data.domains.join(", ")} · ${tz}` : " "}</p>
        </div>
        <div class="span-7 head-actions">
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

      <div class="grid">
        <FilterBar filters={v.view.filters} onRemove={v.removeFilter} retention={me.data?.retentionDays ?? 90} />
      </div>

      <div class="grid figures ruled" aria-busy={stats.loading}>
        {t ? (
          <>
            <Figure label="Views" value={num(t.views)} cur={t.views} prev={p?.views} />
            <Figure label="Visitors" value={num(t.uniques)} cur={t.uniques} prev={p?.uniques} />
            <Figure label="Median visible time" value={duration(t.visibleMsP50)} cur={t.visibleMsP50} prev={p?.visibleMsP50} />
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
            <div class="figure span-3" key={i}>
              <Skeleton lines={2} />
            </div>
          ))
        )}
      </div>

      <div class="grid ruled">
        <div class="span-12">{s ? <LineChart series={s.series} prev={s.prevSeries} hourly={hourly} /> : <Skeleton lines={6} />}</div>
      </div>

      {s && (
        <div class="grid">
          <Section title="Pages" meta="Views">
            <BarList rows={s.pages} total={t!.views} onPick={pick("path")} empty="No page views in this range." />
          </Section>
          <Section title="Referrers" meta="Views">
            <BarList rows={s.refs} total={t!.views} onPick={pick("ref")} empty="No referrers yet. Direct visits and private links don't send one." />
          </Section>

          <Section title="Link tags" meta="?ref= and utm_source">
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
          <Section title="Countries" meta="Views">
            <BarList rows={s.countries} total={t!.views} label={(k) => countryName(k)} onPick={pick("country")} empty="No location data in this range." />
          </Section>

          <Section title="Devices" span={4}>
            <BarList rows={s.devices} total={t!.views} label={(k) => k[0]!.toUpperCase() + k.slice(1)} onPick={pick("device")} empty="No data." limit={5} />
          </Section>
          <Section title="Browsers" span={4}>
            <BarList rows={s.browsers} total={t!.views} onPick={pick("browser")} empty="No data." limit={5} />
          </Section>
          <Section title="Operating systems" span={4}>
            <BarList rows={s.os} total={t!.views} onPick={pick("os")} empty="No data." limit={5} />
          </Section>

          <Section title="Sections" span={12} meta={s.funnel.length ? "Share of page loads that reached each section" : undefined}>
            {s.funnel.length ? (
              <Funnel steps={s.funnel} loads={t!.loads} />
            ) : (
              <p class="empty">
                Mark sections with <code>data-lf-section="name"</code>, then list them in order under Settings to see how far people read.
              </p>
            )}
          </Section>

          <Section title="Custom events" meta="Count">
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
                  <li class="props" style={{ listStyle: "none" }}>
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
          <Section title="Outbound links" meta="Clicks">
            <BarList rows={s.outbound} total={s.outbound.reduce((a, r) => a + r.value, 0)} empty="No clicks to other sites yet." />
          </Section>

          <Section title="AI agents and crawlers" meta="Fetches">
            {s.agents.length ? (
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
                    {s.agents.slice(0, 20).map((a) => (
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
              </div>
            ) : (
              <p class="empty">Bots don't run JavaScript. Add the server snippet from Settings to log GPTBot, ClaudeBot and others.</p>
            )}
          </Section>
          <Section title="Core Web Vitals" meta="75th percentile">
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
                  <span class="rating good">Good</span>
                  <span class="rating warn">Needs work</span>
                  <span class="rating bad">Poor</span>
                </p>
              </div>
            ) : (
              <p class="empty">Vitals arrive when visitors leave a page. Check back after some traffic.</p>
            )}
          </Section>

          <Section title="Not found" meta="404 views">
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
          <Section title="About these numbers">
            <p class="note">
              Visitors are counted per day from a salted hash that rotates at midnight UTC, so one person on two days counts twice. Medians and percentiles over several days are averages of
              each day's value. No cookies, no stored IP addresses.
            </p>
          </Section>
        </div>
      )}
    </Shell>
  );
}
