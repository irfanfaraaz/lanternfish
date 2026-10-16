export interface Geo {
  country: string | null;
  city: string | null;
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string" || v === "" || v === "XX" || v === "T1") return null;
  return v.slice(0, max);
};

export function geoFrom(req: Request, proxied: boolean): Geo {
  if (proxied) {
    const city = req.headers.get("x-lf-city");
    let decoded = city;
    try {
      decoded = city ? decodeURIComponent(city) : null;
    } catch {}
    return { country: clean(req.headers.get("x-lf-country")?.toUpperCase(), 2), city: clean(decoded, 80) };
  }
  const cf = (req as Request & { cf?: IncomingRequestCfProperties }).cf;
  return { country: clean(cf?.country, 2), city: clean(cf?.city, 80) };
}
