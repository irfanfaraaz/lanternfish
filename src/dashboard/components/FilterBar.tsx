import type { FilterDim, Filters } from "../../shared/types";
import { countryName } from "../format";
import { Close } from "../icons";

const NAMES: Record<FilterDim, string> = {
  path: "Page",
  ref: "Referrer",
  tag: "Tag",
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
  event: "Event",
};

export function FilterBar({ filters, onRemove, retention }: { filters: Filters; onRemove: (d: FilterDim) => void; retention: number }) {
  const active = Object.entries(filters) as [FilterDim, string][];
  if (!active.length) return null;
  return (
    <div class="filters span-12" role="region" aria-label="Active filters">
      {active.map(([dim, v]) => (
        <span class="chip" key={dim}>
          <b>{NAMES[dim]}</b>
          {dim === "country" ? countryName(v) : v}
          <button type="button" aria-label={`Remove ${NAMES[dim]} filter`} onClick={() => onRemove(dim)}>
            <Close />
          </button>
        </span>
      ))}
      <span class="note">Filtered views read raw events, so they reach back {retention} days.</span>
    </div>
  );
}
