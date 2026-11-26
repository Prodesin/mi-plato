/* Kit de componentes: sustituye a `cursor/pages` (el kit propietario del canvas original).
 * Implementa solo lo que usa la app, con aspecto iOS limpio. Los estilos están en styles.css (clases k-*).
 * Los «tokens» de useGrokTheme() se calculan en JS (claro/oscuro) porque la app los usa en estilos en línea. */
import "preact/compat";
import { options, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export { useEffect, useMemo, useRef, useState };
export type ReactNode = ComponentChildren;

/* ------------------------------------------------------------------ */
/* Espacios duros entre número y unidad (evita «g» o «kcal» solos en otra línea)  */
/* ------------------------------------------------------------------ */
const NB_RE = /(\d) (?=(?:kg|g|kcal|min|s|h|km|ml|L|m|cm|mg\/dL|mg|%)(?![\p{L}\d]))/gu;
export const nb = (s: string): string => s.replace(NB_RE, "$1 ");

const prevVnode = options.vnode;
options.vnode = (vnode) => {
  const props = vnode.props as { children?: unknown };
  const c = props.children;
  if (typeof c === "string") props.children = nb(c);
  else if (Array.isArray(c)) props.children = c.map((x) => (typeof x === "string" ? nb(x) : x));
  prevVnode?.(vnode);
};

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */
const FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

function makeTheme(dark: boolean) {
  return {
    kind: dark ? ("dark" as const) : ("light" as const),
    font: {
      family: FAMILY,
      heading1: { fontSize: 34, lineHeight: "41px", letterSpacing: "-0.02em" },
      heading3: { fontSize: 20, lineHeight: "25px", letterSpacing: "-0.01em" },
      body1: { fontSize: 17, lineHeight: "22px" },
      subtext: { fontSize: 15, lineHeight: "20px" },
      label: { fontSize: 13, lineHeight: "18px" },
      caption: { fontSize: 12, lineHeight: "16px" },
      metric: { fontSize: 28, lineHeight: "34px", letterSpacing: "-0.02em" },
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    radius: { full: 999, xl: 20 },
    motion: { hover: "120ms", easing: "ease-out" },
    text: dark
      ? { primary: "#f5f5f7", secondary: "rgba(235,235,245,0.6)", tertiary: "rgba(235,235,245,0.3)", accent: "#0a84ff", accentDeep: "#64d2ff", success: "#30d158", warning: "#ff9f0a", danger: "#ff453a", yellow: "#ffd60a", purple: "#bf5af2", pink: "#ff375f", teal: "#64d2ff" }
      : { primary: "#000000", secondary: "rgba(60,60,67,0.6)", tertiary: "rgba(60,60,67,0.3)", accent: "#007AFF", accentDeep: "#0051d5", success: "#34c759", warning: "#ff9500", danger: "#ff3b30", yellow: "#ffcc00", purple: "#af52de", pink: "#ff2d55", teal: "#5ac8fa" },
    fill: dark
      ? { secondary: "#2c2c2e", accent: "#0a84ff", accentSubtle: "rgba(10,132,255,0.22)" }
      : { secondary: "#e5e5ea", accent: "#007AFF", accentSubtle: "rgba(0,122,255,0.12)" },
    bg: { elevated: dark ? "#1c1c1e" : "#ffffff" },
    border: dark
      ? { subtle: "rgba(235,235,245,0.18)", strong: "rgba(235,235,245,0.3)" }
      : { subtle: "rgba(60,60,67,0.12)", strong: "rgba(60,60,67,0.25)" },
    dataviz: dark
      ? {
          categorical: ["#0a84ff", "#ff9f0a", "#30d158", "#64d2ff", "#bf5af2", "#ffd60a", "#ff375f"],
          other: "#8e8e93",
          blue5: "#0a84ff",
          sequential: ["#1c3a6c", "#1d4ed8", "#0a84ff", "#64d2ff", "#b9f2ff"],
          areaAlpha: "33",
        }
      : {
          categorical: ["#007AFF", "#ff9500", "#34c759", "#5ac8fa", "#af52de", "#ffcc00", "#ff2d55"],
          other: "#8e8e93",
          blue5: "#007AFF",
          sequential: ["#d0e1fd", "#82b1ff", "#3b82f6", "#007AFF", "#003b95"],
          areaAlpha: "33",
        },
  };
}

export type Theme = ReturnType<typeof makeTheme>;
const THEME_LIGHT = makeTheme(false);
const THEME_DARK = makeTheme(true);
const darkMQ = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

/** Tokens claro/oscuro según prefers-color-scheme; se vuelve a renderizar al cambiar. */
export function useGrokTheme(): Theme {
  const [dark, setDark] = useState(!!darkMQ?.matches);
  useEffect(() => {
    if (!darkMQ) return;
    const on = () => setDark(darkMQ.matches);
    on();
    if (darkMQ.addEventListener) darkMQ.addEventListener("change", on);
    else (darkMQ as MediaQueryList).addListener(on);
    return () => {
      if (darkMQ.removeEventListener) darkMQ.removeEventListener("change", on);
      else (darkMQ as MediaQueryList).removeListener(on);
    };
  }, []);
  return dark ? THEME_DARK : THEME_LIGHT;
}

/* ------------------------------------------------------------------ */
/* Componentes básicos                                                 */
/* ------------------------------------------------------------------ */
export function Page({ children }: { title?: string; summary?: string; width?: string; children?: ReactNode }) {
  return <div class="k-page">{children}</div>;
}

export function Text({ children }: { children?: ReactNode }) {
  return <p class="k-text">{children}</p>;
}

export function Button({
  label,
  onClick,
  variant,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "default";
  disabled?: boolean;
}) {
  return (
    <button type="button" class={`k-btn${variant === "primary" ? " k-btn--primary" : ""}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export type Tone = "accent" | "success" | "neutral" | "warning" | "danger" | "info";

export function Status({ tone, children }: { tone?: Tone; children?: ReactNode }) {
  return <span class={`k-status k-status--${tone ?? "neutral"}`}>{children}</span>;
}

export function Callout({ tone, lead, children }: { tone?: Tone; lead?: string; children?: ReactNode }) {
  return (
    <div class={`k-callout k-callout--${tone ?? "info"}`} role="note">
      {lead ? <strong>{lead}</strong> : null} {children}
    </div>
  );
}

export function Grid({ columns, children }: { columns?: number; plain?: boolean; children?: ReactNode }) {
  return (
    <div class="k-grid" style={{ gridTemplateColumns: `repeat(${columns ?? 2}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  const numeric = type === "number";
  return (
    <label class="k-field">
      {label ? <span class="k-field__label">{label}</span> : null}
      <input
        class="k-input"
        type="text"
        inputMode={numeric ? "decimal" : "text"}
        enterKeyHint="done"
        autoComplete="off"
        autoCapitalize="off"
        spellcheck={false}
        value={value}
        placeholder={placeholder}
        onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  options: opts,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <label class="k-field">
      {label ? <span class="k-field__label">{label}</span> : null}
      <span class="k-select">
        <select value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as T)}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  options: opts,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div class="k-seg" role="group">
      {opts.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} class="k-toggle" onClick={() => onChange(!value)}>
      <span class="k-toggle__label">{label}</span>
      <span class="k-toggle__track" aria-hidden="true">
        <span class="k-toggle__thumb" />
      </span>
    </button>
  );
}

export function Steps({ steps }: { steps: { title: string; detail?: string }[] }) {
  return (
    <ol class="k-steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span class="k-steps__n" aria-hidden="true">
            {i + 1}
          </span>
          <span class="k-steps__body">
            <span class="k-steps__title">{s.title}</span>
            {s.detail ? <span class="k-steps__detail">{s.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Metrics({ metrics }: { metrics: { value: string; label: string; detail?: string; tone?: Tone }[] }) {
  return (
    <div class="k-metrics">
      {metrics.map((m) => (
        <div class="k-metric" key={m.label}>
          <div class={`k-metric__value${m.tone === "success" ? " is-success" : ""}`}>{m.value}</div>
          <div class="k-metric__label">{m.label}</div>
          {m.detail ? <div class="k-metric__detail">{m.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

type Cell = string | { text: string; tone?: Tone };

export function Table({ columns, rows, align }: { columns: string[]; rows: Cell[][]; align?: ("start" | "end")[] }) {
  return (
    <div class="k-table-wrap">
      <table class="k-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} style={{ textAlign: align?.[i] ?? "start" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => {
                const text = typeof cell === "string" ? cell : cell.text;
                const tone = typeof cell === "string" ? undefined : cell.tone;
                return (
                  <td key={ci} style={{ textAlign: align?.[ci] ?? "start" }} class={tone ? `is-${tone}` : undefined}>
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avisos (toast) y diálogo de confirmación                            */
/* ------------------------------------------------------------------ */
let toastSet: ((t: { msg: string; error?: boolean; id: number } | null) => void) | null = null;
let toastTimer = 0;
export function toast(msg: string, error?: boolean): void {
  toastSet?.({ msg, error, id: Date.now() });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastSet?.(null), error ? 5200 : 2800);
}

export function Toast() {
  const [t, setT] = useState<{ msg: string; error?: boolean; id: number } | null>(null);
  useEffect(() => {
    toastSet = setT;
    return () => {
      toastSet = null;
    };
  }, []);
  return (
    <div class={`k-toast${t ? " is-show" : ""}${t?.error ? " is-error" : ""}`} role="status" aria-live="polite">
      {t?.msg ?? ""}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} class="k-dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }} onClick={(e) => { if (e.target === ref.current) onCancel(); }}>
      <h2>{title}</h2>
      <div class="k-dialog__body">{body}</div>
      <div class="k-dialog__actions">
        <button type="button" class="k-btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" class={`k-btn ${danger ? "k-btn--danger" : "k-btn--primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
