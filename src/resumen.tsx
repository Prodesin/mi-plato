/* Pantalla «Resumen» (la primera al abrir): cómo va el día de un vistazo. Pocas cosas, grandes y claras. */
import { useMemo, useRef } from "preact/hooks";
import { queComer, siguienteToma, totalesDia } from "./coach";
import type { Datos } from "./data";
import { Button } from "./kit";
import type { Perfil, Por100 } from "./types";
import { DIAS_CORTOS, addDays, dowIndex, fechaLarga, fmt, horaAhora, isoDate, kcal as ktxt } from "./util";

type Nivel = "ok" | "warn" | "danger";
const VAR: Record<Nivel, string> = { ok: "var(--success)", warn: "var(--warn)", danger: "var(--danger)" };

/** Qué se espera llevar ya según la hora del día (para no dar la alarma por la mañana). */
const esperado = (hora: string): number => {
  const [h, m] = hora.split(":").map(Number);
  const x = (h || 0) + (m || 0) / 60;
  return x <= 12 ? 0.35 : x <= 16 ? 0.6 : x <= 20 ? 0.8 : 1;
};

export function estadoDia(tot: Por100, perfil: Perfil, hora: string, hay: boolean): { kcal: Nivel; prot: Nivel; frase: string } {
  const e = esperado(hora);
  const kcal: Nivel = tot.kcal > perfil.kcalMax * 1.1 ? "danger" : tot.kcal >= perfil.kcal * e * 0.85 ? "ok" : "warn";
  const prot: Nivel = tot.p >= perfil.prot * e * 0.85 ? "ok" : "warn";
  let frase = "Vas bien";
  if (!hay) frase = "Empieza el día";
  else if (kcal === "danger") frase = "Te has pasado un poco";
  else if (prot === "warn" && tot.p < perfil.prot * e * 0.6) frase = "Te falta proteína";
  else if (prot === "warn") frase = "Casi, falta algo de proteína";
  else if (tot.kcal < perfil.kcal * e * 0.6) frase = "Vas corto de comida";
  return { kcal, prot, frase };
}

function Doble({ kcal, prot, nk, np }: { kcal: number; prot: number; nk: Nivel; np: Nivel }) {
  const aro = (r: number, frac: number, n: Nivel) => {
    const C = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, frac));
    return (
      <>
        <circle cx="60" cy="60" r={r} fill="none" stroke-width="12" style={{ stroke: VAR[n] }} opacity="0.2" />
        {f > 0 ? <circle cx="60" cy="60" r={r} fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray={`${C * f} ${C}`} transform="rotate(-90 60 60)" style={{ stroke: VAR[n] }} /> : null}
      </>
    );
  };
  return <svg class="res-ring" viewBox="0 0 120 120" aria-hidden="true">{aro(52, kcal, nk)}{aro(37, prot, np)}</svg>;
}

export function Resumen({ datos, irAHoy, anadir, foto, fotoBusy }: { datos: Datos; irAHoy: () => void; anadir: () => void; foto: (f: File) => void; fotoBusy: boolean }) {
  const { perfil, comidas, catalogo } = datos;
  const hoy = isoDate();
  const hora = horaAhora();
  const fotoRef = useRef<HTMLInputElement>(null);
  const delDia = useMemo(() => comidas.filter((m) => m.fecha === hoy).sort((a, b) => a.hora.localeCompare(b.hora)), [comidas, hoy]);
  const tot = totalesDia(delDia);
  const hay = delDia.length > 0;
  const est = estadoDia(tot, perfil, hora, hay);
  const toma = siguienteToma(delDia, hora);
  const frecIds = useMemo(() => datos.frecuentes.filter((f) => f.foodId).map((f) => f.foodId!), [datos.frecuentes]);
  const consejo = useMemo(() => queComer({ perfil, dia: delDia, toma, frecuentes: frecIds, catalogo, excluir: [] }).opciones[0], [perfil, delDia, toma, frecIds, catalogo]);
  const h = Number(hora.split(":")[0]);
  const saludo = h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  const kc = perfil.kcal - tot.kcal;
  const pr = perfil.prot - tot.p;

  const semana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const f = addDays(hoy, i - 6);
      const ms = comidas.filter((m) => m.fecha === f);
      if (!ms.length) return { f, nivel: null as Nivel | null };
      const t = totalesDia(ms);
      const nivel: Nivel = t.kcal > perfil.kcalMax * 1.15 ? "danger" : t.kcal >= perfil.kcalMin * 0.85 && t.p >= perfil.protMin * 0.85 ? "ok" : "warn";
      return { f, nivel };
    });
  }, [comidas, hoy, perfil]);

  return (
    <div class="res">
      <header class="apple-header res__head">
        <div class="apple-title-wrap">
          <h1 class="apple-large-title" aria-hidden="true">Resumen</h1>
          <small class="apple-date">{saludo}, {perfil.nombre}<span class="d-largo"> · {fechaLarga(hoy)}</span></small>
        </div>
      </header>
      <section class="ep-card res__dia" aria-label="Cómo va el día">
        <div class="res__ring">
          <Doble kcal={tot.kcal / perfil.kcal} prot={tot.p / perfil.prot} nk={est.kcal} np={est.prot} />
          <div class="res__centro"><b>{fmt(Math.max(0, kc))}</b><span>kcal que te quedan</span></div>
        </div>
        <div class="res__txt">
          <p class="res__frase" aria-live="polite">{est.frase}</p>
          <ul class="res__leyenda">
            <li><i style={{ background: VAR[est.kcal] }} />Calorías <b>{ktxt(tot.kcal)}</b> <small>de {ktxt(perfil.kcal)}</small></li>
            <li><i style={{ background: VAR[est.prot], opacity: 0.75 }} />Proteína <b>{fmt(tot.p)} g</b> <small>de {fmt(perfil.prot)} g</small></li>
          </ul>
          {hay && consejo ? (
            <p class="res__consejo"><b>{consejo.titulo}</b> <span>{consejo.porque}</span></p>
          ) : (
            <p class="res__consejo"><span>Apunta lo que comas y te digo cómo mejorarlo con pequeños cambios.</span></p>
          )}
        </div>
      </section>
      <div class="res__acciones">
        <Button label="Añadir comida" variant="primary" onClick={anadir} />
        <button type="button" class="res__foto" aria-label="Hacer una foto al plato" disabled={fotoBusy} onClick={() => fotoRef.current?.click()}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          <span>{fotoBusy ? "Analizando…" : "Foto"}</span>
        </button>
        <input ref={fotoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const i = e.currentTarget as HTMLInputElement; const f = i.files?.[0]; i.value = ""; if (f) foto(f); }} />
      </div>
      <button type="button" class="ep-card res__ver" onClick={irAHoy}>
        <span>Ver el día</span>
        <small>{hay ? `${delDia.length} ${delDia.length === 1 ? "apunte" : "apuntes"} hoy` : "Todavía nada"}</small>
        <i aria-hidden="true">›</i>
      </button>
      <div class="res__semana" role="img" aria-label="Últimos 7 días: verde va bien, naranja a medias, rojo te pasaste, gris sin datos">
        {semana.map((d) => (
          <span key={d.f} class="res__dia-pt"><i style={{ background: d.nivel ? VAR[d.nivel] : "var(--card2)" }} /><small>{DIAS_CORTOS[dowIndex(d.f)]}</small></span>
        ))}
      </div>
    </div>
  );
}
