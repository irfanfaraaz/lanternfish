import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { Check, Copy } from "../icons";

export function Section({ title, meta, span = 6, children, id }: { title: string; meta?: ComponentChildren; span?: 3 | 4 | 5 | 6 | 7 | 8 | 12; children: ComponentChildren; id?: string }) {
  const hid = id ?? `h-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section class={`section span-${span}`} aria-labelledby={hid}>
      <header>
        <h2 id={hid}>{title}</h2>
        {meta && <span class="meta">{meta}</span>}
      </header>
      {children}
    </section>
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
    <button type="button" class="btn quiet" onClick={copy} aria-live="polite">
      {done ? <Check /> : <Copy />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Snippet({ title, code, children }: { title: string; code: string; children?: ComponentChildren }) {
  return (
    <div class="snippet">
      <div class="snippet-head">
        <h3>{title}</h3>
        <CopyButton text={code} />
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
    <div aria-hidden="true" style={{ display: "grid", gap: "12px", padding: "12px 0" }}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} class="skel" style={{ width: `${90 - i * 17}%` }} />
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
