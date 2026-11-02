import type { SiteSummary } from "../../shared/types";
import { useApi } from "../api";
import { Sparkline } from "../charts/Sparkline";
import { Shell } from "../components/Shell";
import { ErrorLine, Skeleton } from "../components/ui";
import { num } from "../format";
import { DoodleLantern, Plus } from "../icons";

export function Sites() {
  const { data, error, loading, reload } = useApi<SiteSummary[]>("/sites");
  const views = data?.reduce((a, s) => a + s.views, 0) ?? 0;

  return (
    <Shell>
      <div class="head">
        <div class="head-title">
          <h1>Sites</h1>
          <p class="sub">
            {data ? (
              <>
                {data.length} {data.length === 1 ? "site" : "sites"} · <span class="n">{num(views)}</span> views in the last 30 days
              </>
            ) : (
              " "
            )}
          </p>
        </div>
        <div class="head-actions">
          <a class="btn primary" href="/new">
            <Plus />
            Add site
          </a>
        </div>
      </div>

      {error && <ErrorLine message={error} retry={reload} />}
      {loading && !data && (
        <div class="panel pad">
          <Skeleton lines={4} />
        </div>
      )}

      {data && data.length === 0 && (
        <div class="card empty-card">
          <DoodleLantern />
          <h2>No sites yet</h2>
          <p>
            Add one, then paste its script tag into your site's <code>&lt;head&gt;</code>. Visits show up here within a few seconds.
          </p>
          <a class="btn primary" href="/new">
            <Plus />
            Add your first site
          </a>
        </div>
      )}

      {data && data.length > 0 && (
        <div class="sites" role="table" aria-label="Sites, last 30 days">
          <div class="sites-row headrow" role="row">
            <span role="columnheader">Site</span>
            <span role="columnheader">Views</span>
            <span role="columnheader">Visitors</span>
            <span role="columnheader">Last 30 days</span>
          </div>
          {data.map((s) => (
            <a class="sites-row lift" role="row" href={`/s/${s.site.id}`} key={s.site.id}>
              <span role="cell">
                <span class="site-name">{s.site.name}</span>
                <span class="site-domain">{s.site.domains.join(", ")}</span>
              </span>
              <span role="cell" aria-label={`${s.views} views`}>
                <span class="cell-label" aria-hidden="true">
                  Views
                </span>
                <span class="big">{num(s.views)}</span>
              </span>
              <span role="cell" aria-label={`${s.uniques} visitors`}>
                <span class="cell-label" aria-hidden="true">
                  Visitors
                </span>
                <span class="big">{num(s.uniques)}</span>
              </span>
              <span role="cell">
                <Sparkline values={s.spark} />
              </span>
            </a>
          ))}
        </div>
      )}
    </Shell>
  );
}
