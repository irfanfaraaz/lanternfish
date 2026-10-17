import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import nextHelper from "../../../snippets/nextjs/lib/lanternfish.ts?raw";
import nextProxy from "../../../snippets/nextjs/proxy.ts?raw";
import nextRouteHandler from "../../../snippets/nextjs/route-handler.ts?raw";
import nextRoute from "../../../snippets/nextjs/app/api/e/route.ts?raw";
import { ATTRIBUTES, GENERIC_PROXY, curlServerEvent, envBlock, scriptTag } from "../../shared/snippets";
import type { Site, SiteInput } from "../../shared/types";
import { api, useApi } from "../api";
import { Shell } from "../components/Shell";
import { CopyButton, ErrorLine, Section, Skeleton, Snippet } from "../components/ui";
import { addDays, todayIn } from "../format";
import { Download } from "../icons";

const zones = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
})();
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const lines = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

function SiteForm({ site, onSaved }: { site?: Site; onSaved: (s: Site) => void }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const tz = site?.timezone ?? browserZone;

  const submit = async (e: Event) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const body: SiteInput = {
      name: String(f.get("name") ?? ""),
      domains: lines(String(f.get("domains") ?? "")),
      timezone: String(f.get("timezone") ?? "UTC"),
      exclude_paths: lines(String(f.get("exclude") ?? "")),
      funnel: lines(String(f.get("funnel") ?? "")),
      public: f.get("public") === "on",
    };
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const s = site ? await api.patch<Site>(`/sites/${site.id}`, body) : await api.post<Site>("/sites", body);
      setSaved(true);
      onSaved(s);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="form" onSubmit={submit} noValidate>
      <div class="field">
        <label for="name">Name</label>
        <input id="name" name="name" required maxLength={80} defaultValue={site?.name ?? ""} placeholder="My portfolio" />
      </div>
      <div class="field">
        <label for="domains">Domains</label>
        <textarea id="domains" name="domains" required defaultValue={site?.domains.join("\n") ?? ""} placeholder={"example.com\nwww.example.com"} />
        <span class="hint">One per line. Events from any other domain are dropped. Use *.example.com for every subdomain.</span>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="tz">Timezone</label>
          <select id="tz" name="timezone">
            {/* <select> has no defaultValue, and Chrome lists old names (Asia/Calcutta), so the saved zone may be missing. */}
            {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => (
              <option key={z} value={z} selected={z === tz}>
                {z}
              </option>
            ))}
          </select>
          <span class="hint">Where this site's days start and end.</span>
        </div>
        <div class="field">
          <span class="label">Public stats</span>
          <label class="check" style={{ minHeight: "40px" }}>
            <input type="checkbox" name="public" defaultChecked={site?.public ?? false} />
            Serve totals at /p/{site?.id ?? "<site>"}
          </label>
        </div>
      </div>
      <div class="field">
        <label for="funnel">Funnel sections, in order</label>
        <textarea id="funnel" name="funnel" defaultValue={site?.funnel.join("\n") ?? ""} placeholder={"hero\nwork\ncontact"} />
        <span class="hint">Names you put in data-lf-section. Lowercase letters, digits, _ and :.</span>
      </div>
      <div class="field">
        <label for="exclude">Never record these paths</label>
        <textarea id="exclude" name="exclude" defaultValue={site?.exclude_paths.join("\n") ?? ""} placeholder="/admin/*" />
        <span class="hint">One per line. * matches anything.</span>
      </div>
      {error && (
        <p class="msg error" role="alert">
          {error}
        </p>
      )}
      <div class="actions">
        <button class="btn primary" type="submit" aria-busy={busy}>
          {busy ? "Saving…" : site ? "Save changes" : "Add site"}
        </button>
        {saved && site && (
          <span class="msg ok" role="status">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}

function Snippets({ site }: { site: Site }) {
  const origin = location.origin;
  return (
    <>
      <Snippet title="Script tag" code={scriptTag(origin, site.id, false)}>
        Paste into the <code>&lt;head&gt;</code> of every page. Works on any site.
      </Snippet>
      <Snippet title="Script tag through your own domain" code={scriptTag(origin, site.id, true)}>
        Use this with the Next.js proxy route below so ad blockers see a first-party request.
      </Snippet>
      <Snippet title="Environment variables (Next.js)" code={envBlock(origin, site.id)}>
        Add these to your Next.js project. The server key is below.
      </Snippet>
      <Snippet title="lib/lanternfish.ts" code={nextHelper}>
        Shared helpers for the proxy route and agent logging.
      </Snippet>
      <Snippet title="app/api/e/route.ts" code={nextRoute}>
        Forwards tracker beacons to Lanternfish with a signed header.
      </Snippet>
      <Snippet title="proxy.ts" code={nextProxy}>
        Logs AI agents and crawlers. Runs only for known bot user agents and never delays the response.
      </Snippet>
      <Snippet title="Route handler, without proxy.ts" code={nextRouteHandler}>
        One line for a single file such as llms.txt. Skip it if you use proxy.ts.
      </Snippet>
      <Snippet title="Any other backend" code={`${GENERIC_PROXY}\n\nServer events:\n${curlServerEvent(origin, site.id)}`} />
      <div class="snippet">
        <div class="snippet-head">
          <h3>Tracking attributes</h3>
        </div>
        <table class="table">
          <tbody>
            {ATTRIBUTES.map(([code, what]) => (
              <tr key={code}>
                <td style={{ width: "40%" }}>
                  <code>{code}</code>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Keys({ site, onChange }: { site: Site; onChange: () => void }) {
  const [shown, setShown] = useState(false);
  const [key, setKey] = useState(site.server_key);
  const [shareUrl, setShareUrl] = useState<string>();
  const [days, setDays] = useState("30");
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => setKey(site.server_key), [site.server_key]);

  const rotate = async () => {
    if (!confirm("Rotate the server key? Your proxy and server snippets stop working until you update LF_SERVER_KEY.")) return;
    try {
      const r = await api.post<{ server_key: string }>(`/sites/${site.id}/rotate-key`);
      setKey(r.server_key);
      setShown(true);
      setMsg("New key made. Update LF_SERVER_KEY wherever you use it.");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const share = async () => {
    try {
      const r = await api.post<{ token: string }>(`/sites/${site.id}/share`, { days: days === "never" ? null : Number(days) });
      setShareUrl(`${location.origin}/share/${r.token}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const revoke = async () => {
    if (!confirm("Revoke every share link for this site? Anyone using one loses access.")) return;
    try {
      await api.post(`/sites/${site.id}/share/revoke`);
      setShareUrl(undefined);
      setMsg("All share links revoked.");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div class="form">
      <div class="field">
        <span class="label">Server key</span>
        <div class="keybox">
          <code>{shown ? key : "•".repeat(32)}</code>
          <button type="button" class="btn quiet" onClick={() => setShown(!shown)}>
            {shown ? "Hide" : "Reveal"}
          </button>
          {shown && <CopyButton text={key} />}
          <button type="button" class="btn danger" onClick={rotate}>
            Rotate
          </button>
        </div>
        <span class="hint">Signs proxied beacons and authorises server events. Keep it out of client code.</span>
      </div>
      <div class="field">
        <span class="label">Read-only share link</span>
        <div class="actions">
          <select class="date" value={days} onChange={(e) => setDays((e.target as HTMLSelectElement).value)} aria-label="Link expires">
            <option value="7">Expires in 7 days</option>
            <option value="30">Expires in 30 days</option>
            <option value="90">Expires in 90 days</option>
            <option value="never">Never expires</option>
          </select>
          <button type="button" class="btn" onClick={share}>
            Create link
          </button>
          <button type="button" class="btn quiet" onClick={revoke}>
            Revoke all links
          </button>
        </div>
        {shareUrl && (
          <div class="keybox">
            <code>{shareUrl}</code>
            <CopyButton text={shareUrl} />
          </div>
        )}
        <span class="hint">Anyone with the link sees this site's overview and realtime count, nothing else.</span>
      </div>
      {site.public && (
        <div class="field">
          <span class="label">Public stats JSON</span>
          <div class="keybox">
            <code>{`${location.origin}/p/${site.id}`}</code>
            <CopyButton text={`${location.origin}/p/${site.id}`} />
          </div>
        </div>
      )}
      {msg && (
        <p class="msg ok" role="status">
          {msg}
        </p>
      )}
      {error && <ErrorLine message={error} />}
    </div>
  );
}

function Data({ site }: { site: Site }) {
  const { route } = useLocation();
  const today = todayIn(site.timezone);
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [before, setBefore] = useState(addDays(today, -365));
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();

  const deleteBefore = async () => {
    if (!confirm(`Delete all of ${site.name}'s data before ${before}? This can't be undone.`)) return;
    try {
      await api.del(`/sites/${site.id}/data?before=${before}`);
      setMsg(`Deleted data before ${before}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const deleteSite = async () => {
    const typed = prompt(`This deletes ${site.name} and all its data. Type the site name to confirm.`);
    if (typed !== site.name) return;
    try {
      await api.del(`/sites/${site.id}`);
      route("/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div class="form">
      <div class="field">
        <span class="label">Export raw events as CSV</span>
        <div class="actions">
          <input class="date" type="date" value={from} max={to} aria-label="From" onChange={(e) => setFrom((e.target as HTMLInputElement).value)} />
          <input class="date" type="date" value={to} min={from} aria-label="To" onChange={(e) => setTo((e.target as HTMLInputElement).value)} />
          <a class="btn" href={`/api/sites/${site.id}/export.csv?from=${from}&to=${to}`} download>
            <Download />
            Download CSV
          </a>
        </div>
        <span class="hint">Up to 400,000 rows per download. Raw events are kept for the retention window; older days exist only as daily totals.</span>
      </div>
      <div class="field danger-zone" style={{ paddingTop: "16px" }}>
        <span class="label">Delete data before a date</span>
        <div class="actions">
          <input class="date" type="date" value={before} max={today} aria-label="Delete before" onChange={(e) => setBefore((e.target as HTMLInputElement).value)} />
          <button type="button" class="btn danger" onClick={deleteBefore}>
            Delete data
          </button>
          <button type="button" class="btn danger" onClick={deleteSite}>
            Delete site
          </button>
        </div>
      </div>
      {msg && (
        <p class="msg ok" role="status">
          {msg}
        </p>
      )}
      {error && <ErrorLine message={error} />}
    </div>
  );
}

export function Settings({ id }: { id: string }) {
  const site = useApi<Site>(`/sites/${id}`);
  const fresh = new URLSearchParams(location.search).has("new");
  return (
    <Shell siteId={id}>
      <div class="head grid">
        <div class="span-7">
          <h1>{site.data?.name ?? " "}</h1>
          <p class="sub">{fresh ? "Site added. Copy the script tag below into your site to start counting." : "Settings"}</p>
        </div>
      </div>
      {site.error && <ErrorLine message={site.error} retry={site.reload} />}
      {!site.data && !site.error && <Skeleton lines={6} />}
      {site.data && (
        <div class="grid">
          <Section title={fresh ? "Install" : "Install snippets"} span={7}>
            <Snippets site={site.data} />
          </Section>
          <div class="span-5" style={{ display: "grid", alignContent: "start" }}>
            <Section title="Site" span={12}>
              <SiteForm key={site.data.id} site={site.data} onSaved={() => site.reload()} />
            </Section>
            <Section title="Keys and sharing" span={12}>
              <Keys site={site.data} onChange={site.reload} />
            </Section>
            <Section title="Data" span={12}>
              <Data site={site.data} />
            </Section>
          </div>
        </div>
      )}
    </Shell>
  );
}

export function NewSite() {
  const { route } = useLocation();
  return (
    <Shell>
      <div class="head grid">
        <div class="span-7">
          <h1>Add a site</h1>
          <p class="sub">You'll get a script tag to paste into it next.</p>
        </div>
      </div>
      <div class="grid">
        <Section title="Site" span={7}>
          <SiteForm onSaved={(s) => route(`/s/${s.id}/settings?new=1`)} />
        </Section>
      </div>
    </Shell>
  );
}
