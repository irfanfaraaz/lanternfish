import type { ComponentChildren } from "preact";
import { useId, useState } from "preact/hooks";
import { Check, Copy, Plus } from "../icons";

type Span = 3 | 4 | 5 | 6 | 7 | 8 | 12;

/** A sketch card with a serif title. `level` 3 when it sits under a band heading. */
export function Section({
  title,
  meta,
  span = 6,
  level = 2,
  tone,
  children,
  id,
}: {
  title: string;
  meta?: ComponentChildren;
  span?: Span;
  level?: 2 | 3;
  tone?: "danger";
  children: ComponentChildren;
  id?: string;
}) {
  const hid = id ?? `h-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const H = level === 3 ? "h3" : "h2";
  return (
    <section class={`section card span-${span}${tone ? ` ${tone}` : ""}`} aria-labelledby={hid}>
      <header>
        <H id={hid}>{title}</H>
        {meta && <span class="meta">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

/** A group of cards under one serif heading, so a long page reads in chapters. */
export function Band({ title, id, children }: { title: string; id: string; children: ComponentChildren }) {
  return (
    <section class="band-group" aria-labelledby={id}>
      <h2 id={id} class="band-title">
        {title}
      </h2>
      <div class="grid cards">{children}</div>
    </section>
  );
}

/** A rubber stamp for a status: one or two words, colour from meaning only. */
export function Stamp({ tone = "ink", children }: { tone?: "ink" | "good" | "wait" | "bad" | "primary"; children: ComponentChildren }) {
  return <span class={`stamp ${tone}`}>{children}</span>;
}

/** A past-tense confirmation on a paper slip. */
export function Slip({ children }: { children: ComponentChildren }) {
  return (
    <span class="slip" role="status">
      <Check />
      {children}
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" class={`btn quiet${done ? " done" : ""}`} onClick={copy} aria-live="polite">
      {done ? <Check /> : <Copy />}
      {done ? "Copied" : label}
    </button>
  );
}

/** A titled code block. `copy` overrides what the button copies, so a secret can be shown masked. */
export function Snippet({ title, code, copy, children }: { title: string; code: string; copy?: string; children?: ComponentChildren }) {
  return (
    <div class="snippet">
      <div class="snippet-head">
        <h3>{title}</h3>
        <CopyButton text={copy ?? code} />
      </div>
      {children && <p>{children}</p>}
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div class="skel-stack" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} class={`skel w${i % 5}`} />
      ))}
    </div>
  );
}

export function ErrorLine({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <p class="msg error" role="alert">
      {message}{" "}
      {retry && (
        <button type="button" class="more" onClick={retry}>
          Try again
        </button>
      )}
    </p>
  );
}

/** A folded group of optional steps. Closed by default. */
export function Disclosure({ title, hint, children }: { title: string; hint?: string; children: ComponentChildren }) {
  return (
    <details class="disclosure">
      <summary>
        <Plus />
        <span class="disclosure-title">{title}</span>
        {hint && <span class="disclosure-hint">{hint}</span>}
      </summary>
      <div class="disclosure-body">{children}</div>
    </details>
  );
}

/**
 * An inline two-step action instead of a native confirm(): the first press arms it and says
 * what will happen; the second does it. Escape or Cancel disarms.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  busyLabel,
  warning,
  onConfirm,
  tone = "danger",
}: {
  label: string;
  confirmLabel: string;
  busyLabel?: string;
  warning: ComponentChildren;
  onConfirm: () => Promise<void> | void;
  tone?: "danger" | "plain";
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const wid = useId();
  const btn = tone === "danger" ? "btn danger" : "btn";
  if (!armed) {
    return (
      <button type="button" class={btn} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };
  return (
    <div class="confirm" role="group" aria-describedby={wid} onKeyDown={(e) => e.key === "Escape" && setArmed(false)}>
      <p id={wid} class="confirm-text">
        {warning}
      </p>
      <div class="actions">
        <button type="button" class={tone === "danger" ? "btn danger solid" : "btn primary"} onClick={run} aria-busy={busy} autoFocus>
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
        <button type="button" class="btn quiet" onClick={() => setArmed(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A number that rolls like an odometer when it changes (and once when it first appears).
 * Each digit is a reel of 0–9 moved by transform only; with reduced motion the reels simply sit
 * on the right digit. Screen readers get the plain value.
 */
export function Odometer({ value, class: cls = "" }: { value: string; class?: string }) {
  const chars = [...value];
  return (
    <span class={`odo n ${cls}`}>
      <span class="sr-only">{value}</span>
      <span class="odo-reels" aria-hidden="true">
        {chars.map((ch, i) => {
          // Keyed from the right, so the units reel stays the units reel when the number grows.
          const k = chars.length - i;
          return /\d/.test(ch) ? (
            <span class="odo-col" key={`d${k}`}>
              <span class="odo-strip" style={{ "--d": ch }}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
              <span class="odo-sizer">0</span>
            </span>
          ) : (
            <span class="odo-ch" key={`c${k}${ch}`}>
              {ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}
