import { useState } from "preact/hooks";
import type { Me } from "../../shared/types";
import { api, useApi } from "../api";

/** Only same-origin paths; `/\\evil.com` and `//evil.com` resolve elsewhere and are refused. */
function safeNext(next: string | null): string {
  if (!next) return "/";
  try {
    const u = new URL(next, location.origin);
    return u.origin === location.origin ? u.pathname + u.search : "/";
  } catch {
    return "/";
  }
}

export function Login() {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const config = useApi<Pick<Me, "mode" | "signups">>("/config");
  const cloud = config.data?.mode === "cloud";
  const signup = cloud && creating && config.data?.signups === true;

  const toggle = () => {
    setCreating(!creating);
    setError(undefined);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const password = f.get("password");
    setBusy(true);
    setError(undefined);
    try {
      if (cloud) await api.post(signup ? "/signup" : "/login", { email: f.get("email"), password });
      else await api.post("/login", { password });
      location.assign(safeNext(new URLSearchParams(location.search).get("next")));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main class="login grid">
      <h1 class="login-mark span-7">
        Lantern
        <br />
        fish<span>.</span>
      </h1>
      <form class="span-5" onSubmit={submit}>
        <p class="note">{cloud ? (signup ? "Create an account to start tracking your sites." : "Private analytics for your sites. Sign in to your account.") : "Private analytics for your sites. Sign in as the owner."}</p>
        {config.error && (
          <p class="msg error" role="alert">
            {config.error}
          </p>
        )}
        {cloud && (
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
        )}
        <div class="field" data-invalid={error ? "" : undefined}>
          <label for="pw">Password</label>
          <input id="pw" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 12 : undefined} autoFocus={!cloud} aria-describedby={error ? "pw-err" : undefined} />
          {signup && <span class="hint">At least 12 characters.</span>}
        </div>
        {error && (
          <p id="pw-err" class="msg error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button class="btn primary" type="submit" aria-busy={busy}>
            {signup ? (busy ? "Creating…" : "Create account") : busy ? "Signing in…" : "Sign in"}
          </button>
          {cloud && config.data?.signups && (
            <button class="linkish" type="button" onClick={toggle}>
              {signup ? "Sign in" : "Create an account"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
