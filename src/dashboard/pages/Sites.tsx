import type { SiteSummary } from "../../shared/types";
import { useApi } from "../api";
import { Sparkline } from "../charts/Sparkline";
import { Shell } from "../components/Shell";
import { ErrorLine, Skeleton } from "../components/ui";
import { num } from "../format";
import { Plus } from "../icons";

export function Sites() {
  const { data, error, loading, reload } = useApi<SiteSummary[]>("/sites");
  const views = data?.reduce((a, s) => a + s.views, 0) ?? 0;

  return (
    <Shell>
      <div class="head grid">
        <div class="span-7">
          <h1>Sites</h1>
          <p class="sub">{data ? `${data.length} ${data.length === 1 ? "site" : "sites"} · ${num(views)} views in the last 30 days` : " "}</p>
        </div>
        <div class="span-5 head-actions">
          <a class="btn primary" href="/new">
            <Plus />
            Add site
          </a>
        </div>
      </div>

      {error && <ErrorLine message={error} retry={reload} />}
      {loading && !data && <Skeleton lines={4} />}

      {data && data.length === 0 && (
        <div class="sites">
          <div class="empty">
            <p>
              No sites yet. Add one, then paste its script tag into your site's <code>&lt;head&gt;</code>. Visits show up here within a few seconds.
            </p>
            <p style={{ marginTop: "16px" }}>
              <a class="btn" href="/new">
                Add your first site
              </a>
            </p>
          </div>
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
            <a class="sites-row" role="row" href={`/s/${s.site.id}`} key={s.site.id}>
              <span role="cell">
                <span class="site-name">{s.site.name}</span>
                <br />
                <span class="site-domain">{s.site.domains.join(", ")}</span>
              </span>
              <span role="cell" aria-label={`${s.views} views`}>
                <span class="cell-label" aria-hidden="true">Views</span>
                <span class="big">{num(s.views)}</span>
              </span>
              <span role="cell" aria-label={`${s.uniques} visitors`}>
                <span class="cell-label" aria-hidden="true">Visitors</span>
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
