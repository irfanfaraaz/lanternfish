import type { Realtime as RT, Site } from "../../shared/types";
import { useApi } from "../api";
import { BarList } from "../charts/BarList";
import { Shell } from "../components/Shell";
import { ErrorLine, Section } from "../components/ui";

export function Realtime({ id }: { id: string }) {
  const site = useApi<Site>(`/sites/${id}`);
  const live = useApi<RT>(`/sites/${id}/realtime`, 30_000);
  const n = live.data?.visitors;

  return (
    <Shell siteId={id}>
      <div class="head grid">
        <div class="span-7">
          <h1>{site.data?.name ?? " "}</h1>
          <p class="sub">Visitors in the last five minutes. Updates every 30 seconds while this tab is open.</p>
        </div>
      </div>
      {live.error && <ErrorLine message={live.error} retry={live.reload} />}
      <div class="grid figures ruled">
        <div class="span-6" style={{ padding: "24px 0 32px" }}>
          <span class="label">
            <span class="pulse" aria-hidden="true" />
            Right now
          </span>
          <div class="live-count" aria-live="polite">
            {n ?? "–"}
          </div>
          <span class="note">{n === 1 ? "visitor" : "visitors"}</span>
        </div>
      </div>
      <div class="grid">
        <Section title="Active pages" meta="Visitors">
          <BarList rows={live.data?.pages ?? []} total={n ?? 0} empty="Nobody's here right now. Share a link and watch this fill in." />
        </Section>
      </div>
    </Shell>
  );
}
