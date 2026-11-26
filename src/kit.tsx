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
const FAMILY = 'system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

function makeTheme(dark: boolean) {
  return {
    kind: dark ? ("dark" as const) : ("light" as const),
    font: {
      family: FAMILY,
      heading1: { fontSize: 28, lineHeight: "34px", letterSpacing: "-0.02em" },
      heading3: { fontSize: 18, lineHeight: "24px", letterSpacing: "-0.01em" },
      body1: { fontSize: 16, lineHeight: "22px" },
      subtext: { fontSize: 15, lineHeight: "20px" },
      label: { fontSize: 13.5, lineHeight: "18px" },
      caption: { fontSize: 13, lineHeight: "17px" },
      metric: { fontSize: 26, lineHeight: "30px", letterSpacing: "-0.02em" },
    },
    weight: { regular: 400, medium: 500, semibold: 600 },
    radius: { full: 999, xl: 16 },
    motion: { hover: "120ms", easing: "ease-out" },
    text: dark
      ? { primary: "#f5f5f7", secondary: "#c3c3cc", tertiary: "#a1a1aa", accent: "#b79cff", accentDeep: "#e0d4ff", success: "#4cd77a", warning: "#ffb938" }
      : { primary: "#111114", secondary: "#44444c", tertiary: "#5f5f69", accent: "#5b2fc4", accentDeep: "#3f1d92", success: "#12803c", warning: "#a85a00" },
    fill: dark
      ? { secondary: "#2c2c2e", accent: "#7c4dde", accentSubtle: "rgba(150,110,255,0.2)" }
      : { secondary: "#ece8f5", accent: "#6a35d6", accentSubtle: "#ece4fd" },
    bg: { elevated: dark ? "#1c1c1e" : "#ffffff" },
    border: dark
      ? { subtle: "rgba(235,235,245,0.14)", strong: "rgba(235,235,245,0.29)" }
      : { subtle: "rgba(60,60,67,0.14)", strong: "rgba(60,60,67,0.29)" },
    dataviz: dark
      ? {
          categorical: ["#a78bfa", "#ff9a3c", "#3fcf7a", "#5fb0ff", "#2cc4d6"],
          other: "#707887",
          blue5: "#7fb0ff",
          sequential: ["#3a2475", "#5b3aa8", "#7c4dde", "#a78bfa", "#d3c3ff"],
          areaAlpha: "33",
        }
      : {
          categorical: ["#6a35d6", "#e8741a", "#17884a", "#1a64dc", "#0e8fa1"],
          other: "#6b7280",
          blue5: "#7fb0ff",
          sequential: ["#e3d9fa", "#c1abf3", "#9370e6", "#6a35d6", "#43208f"],
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
