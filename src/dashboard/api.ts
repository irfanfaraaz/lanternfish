import { useEffect, useState } from "preact/hooks";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let shareToken: string | null = null;

/** In share mode every request carries the share token instead of the session cookie. */
export function setShareToken(token: string | null) {
  shareToken = token;
}

export function isShareMode() {
  return shareToken !== null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (shareToken) headers.authorization = `Share ${shareToken}`;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, credentials: "same-origin", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new ApiError(0, "Can't reach Lanternfish. Check your connection and try again.");
  }
  if (res.status === 401 && !shareToken && path !== "/login") {
    const next = location.pathname + location.search;
    if (location.pathname !== "/login") location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new ApiError(401, "Signed out");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, j.error ?? `Something went wrong (${res.status}). Try again.`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T = void>(path: string) => request<T>("DELETE", path),
};

export interface Loaded<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

/** Fetches `path` (skipped when null) and refetches when it changes. Keeps old data while reloading. */
export function useApi<T>(path: string | null, pollMs = 0): Loaded<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    setLoading(true);
    api.get<T>(path).then(
      (d) => {
        if (!live) return;
        setData(d);
        setError(undefined);
        setLoading(false);
      },
      (e: Error) => {
        if (!live) return;
        setError(e.message);
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
  }, [path, tick]);

  useEffect(() => {
    if (!pollMs || !path) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, pollMs);
    return () => clearInterval(id);
  }, [path, pollMs]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
