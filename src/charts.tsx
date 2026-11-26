/* Gráficos SVG sencillos: anillo, barra con banda objetivo y barras por día. */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useGrokTheme } from "./kit";
import { fmt } from "./util";

export function Anillo({ valor, objetivo, etiqueta, unidad, color, minimo }: { valor: number; objetivo: number; etiqueta: string; unidad: string; color: string; minimo?: number }) {
  const th = useGrokTheme();
  const R = 38, C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, valor / Math.max(objetivo, 1)));
  const pasado = valor > objetivo * 1.08;
  const col = pasado ? th.text.warning : color;
  return (
    <div class="ring" role="img" aria-label={`${etiqueta}: ${fmt(valor)} de ${fmt(objetivo)} ${unidad}`}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <circle cx="50" cy="50" r={R} fill="none" stroke={th.border.subtle} strokeWidth="9" />
        <circle cx="50" cy="50" r={R} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 50 50)" />
      </svg>
      <div class="ring__t"><b>{fmt(valor)}{unidad === "g" ? <small class="ring__u">{"\u00a0g"}</small> : null}</b><span>{etiqueta}</span></div>
    </div>
  );
}

/** Barra de progreso con banda objetivo [lo, hi] y marca opcional. */
export function Barra({ valor, max, lo, hi, marca, color, etiqueta, texto }: { valor: number; max: number; lo?: number; hi?: number; marca?: number; color: string; etiqueta: string; texto: string }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div class="bar" role="img" aria-label={`${etiqueta}: ${texto}`}>
      <div class="bar__row"><span>{etiqueta}</span><b>{texto}</b></div>
      <div class="bar__track">
        {lo != null && hi != null ? <i class="bar__band" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} /> : null}
        <i class="bar__fill" style={{ width: pct(valor), background: color }} />
        {marca != null ? <i class="bar__mark" style={{ left: pct(marca) }} /> : null}
      </div>
    </div>
  );
}

export type BarraDia = { label: string; valor: number; sel?: boolean; sinDatos?: boolean };
/** Barras por día con banda de objetivo. */
export function BarrasDias({ dias, lo, hi, formato, color, unidad, titulo }: { dias: BarraDia[]; lo: number; hi: number; formato: (v: number) => string; color: string; unidad: string; titulo: string }) {
  const th = useGrokTheme();
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [sel, setSel] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const m = () => setW(Math.max(220, Math.round(el.getBoundingClientRect().width)));
    m();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", m); return () => window.removeEventListener("resize", m); }
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(null), [titulo]);
  const H = 220, mg = { l: 46, r: 8, t: 14, b: 26 };
  const iw = w - mg.l - mg.r, ih = H - mg.t - mg.b;
  const raw = Math.max(hi * 1.25, ...dias.map((d) => d.valor)) || 1;
  const paso = raw > 800 ? 500 : raw > 300 ? 100 : 20;
  const maxV = Math.ceil(raw / paso) * paso;
  const y = (v: number) => mg.t + ih - (v / maxV) * ih;
  const bw = iw / dias.length;
  const ticks = [0, 0.5, 1].map((k) => maxV * k);
  return (
    <div class="k-chart" ref={wrap}>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${titulo}: ${dias.map((d) => `${d.label} ${d.sinDatos ? "sin datos" : formato(d.valor)}`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={mg.l} x2={w - mg.r} y1={y(t)} y2={y(t)} stroke={th.border.subtle} />
            <text x={mg.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={th.text.tertiary} fontFamily={th.font.family}>{fmt(t)}</text>
          </g>
        ))}
        <rect x={mg.l} y={y(hi)} width={iw} height={Math.max(2, y(lo) - y(hi))} fill={th.dataviz.categorical[2]} opacity={0.16} />
        <line x1={mg.l} x2={w - mg.r} y1={y(hi)} y2={y(hi)} stroke={th.dataviz.categorical[2]} strokeDasharray="4 3" strokeWidth={1.2} />
        {dias.map((d, i) => (
          <g key={i} onPointerDown={() => setSel(i)} style={{ cursor: "pointer" }}>
            <rect x={mg.l + i * bw} y={mg.t} width={bw} height={ih + mg.b} fill="transparent" />
            {!d.sinDatos ? <rect x={mg.l + i * bw + bw * 0.18} y={y(d.valor)} width={bw * 0.64} height={Math.max(1, mg.t + ih - y(d.valor))} rx={5} fill={color} opacity={sel === i || sel === null ? 1 : 0.55} /> : <text x={mg.l + i * bw + bw / 2} y={mg.t + ih - 6} textAnchor="middle" fontSize={11} fill={th.text.tertiary}>—</text>}
            <text x={mg.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize={12} fontWeight={d.sel ? 800 : 500} fill={d.sel ? th.text.primary : th.text.tertiary} fontFamily={th.font.family}>{d.label}</text>
          </g>
        ))}
      </svg>
      <div class="k-chart__read" aria-live="polite">{sel != null && dias[sel] ? (dias[sel].sinDatos ? `${dias[sel].label}: sin apuntar` : `${dias[sel].label}: ${formato(dias[sel].valor)}`) : `La franja verde es tu objetivo (${formato(lo)} a ${formato(hi)}). Toca una barra.`}</div>
      <span hidden>{unidad}</span>
    </div>
  );
}
