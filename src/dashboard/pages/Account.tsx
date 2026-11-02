import { useState } from "preact/hooks";
import type { Me, Usage } from "../../shared/types";
import { api, useApi } from "../api";
import { Shell } from "../components/Shell";
import { ErrorLine, Section, Skeleton } from "../components/ui";
import { num } from "../format";

function ChangePassword() {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    setBusy(true);
    setError(undefined);
    setDone(false);
    try {
      await api.post("/account/password", { current: f.get("current"), next: f.get("next") });
      form.reset();
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="form" onSubmit={submit}>
      <div class="field">
        <label for="pw-current">Current password</label>
        <input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div class="field">
        <label for="pw-next">New password</label>
        <input id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={200} aria-describedby="pw-next-hint" />
        <span id="pw-next-hint" class="hint">
          At least 12 characters. Other devices are signed out.
        </span>
      </div>
      {error && (
        <p class="msg error" role="alert">
          {error}
        </p>
      )}
      <div class="actions">
        <button class="btn primary" type="submit" aria-busy={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
        {done && (
          <span class="msg ok" role="status">
            Password changed.
          </span>
        )}
      </div>
    </form>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!matches) return;
    const password = new FormData(e.target as HTMLFormElement).get("password");
    setBusy(true);
    setError(undefined);
    try {
      await api.del("/account", { password });
      location.assign("/login");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form class="form" onSubmit={submit}>
      <p class="note">This deletes your account, your sites and all their data. It can't be undone.</p>
      <div class="field">
        <label for="del-email">Type {email} to confirm</label>
        <input id="del-email" name="confirm" type="email" autoComplete="off" value={typed} onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
      </div>
      <div class="field">
        <label for="del-pw">Password</label>
        <input id="del-pw" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p class="msg error" role="alert">
          {error}
        </p>
      )}
      <div class="actions">
        <button class="btn danger" type="submit" disabled={!matches || busy} aria-busy={busy}>
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </form>
  );
}

export function Account() {
  const me = useApi<Me>("/me");
  const usage = useApi<Usage>("/usage");
  const cloud = me.data?.mode === "cloud" && me.data.email;

  return (
    <Shell>
      <div class="head grid">
        <div class="span-7">
          <h1>Account</h1>
          {me.data && <p class="sub">{cloud ? me.data.email : "Accounts are only used in cloud mode."}</p>}
        </div>
      </div>
      {me.error && <ErrorLine message={me.error} retry={me.reload} />}
      {!me.data && !me.error && <Skeleton />}
      {cloud && me.data && (
        <div class="grid">
          <Section title="Today" span={6} meta="UTC">
            {usage.error ? (
              <ErrorLine message={usage.error} retry={usage.reload} />
            ) : !usage.data ? (
              <Skeleton lines={2} />
            ) : (
              <p>
                {num(usage.data.events)}
                {me.data.limits ? ` of ${num(me.data.limits.events)}` : ""} events, {num(usage.data.rows_read)}
                {me.data.limits ? ` of ${num(me.data.limits.reads)}` : ""} reads.
              </p>
            )}
          </Section>
          <Section title="Change password" span={6}>
            <ChangePassword />
          </Section>
          <Section title="Delete account" span={6}>
            <DeleteAccount email={me.data.email!} />
          </Section>
        </div>
      )}
    </Shell>
  );
}
