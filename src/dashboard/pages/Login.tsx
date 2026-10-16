import { useState } from "preact/hooks";
import { api } from "../api";

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

  const submit = async (e: Event) => {
    e.preventDefault();
    const password = new FormData(e.target as HTMLFormElement).get("password");
    setBusy(true);
    setError(undefined);
    try {
      await api.post("/login", { password });
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
        <p class="note">Private analytics for your sites. Sign in as the owner.</p>
        <div class="field" data-invalid={error ? "" : undefined}>
          <label for="pw">Password</label>
          <input id="pw" name="password" type="password" autoComplete="current-password" required autoFocus aria-describedby={error ? "pw-err" : undefined} />
        </div>
        {error && (
          <p id="pw-err" class="msg error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button class="btn primary" type="submit" aria-busy={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
