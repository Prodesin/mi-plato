/* «Compartir con Coco»: texto legible + JSON, webhook opcional, Atajo de iPhone y compartir/copiar. */
import { corregirComida, objetivoToma, totalesDia, revisionDia } from "./coach";
import type { Correccion, Meal, Perfil } from "./types";
import { sumar, tomaLabel } from "./types";
import { fechaLarga, fmt } from "./util";

export type Paquete = { tipo: "mi-plato"; fecha: string; context: string; texto: string; dia: unknown };

const r1 = (n: number) => Math.round(n * 10) / 10;
const corrTxt = (c: Correccion) => `${c.tipo === "ok" ? "✔" : c.tipo === "alerta" ? "⚠⚠" : "⚠"} ${c.texto}${c.porque ? " — " + c.porque : ""}${c.cifra ? " (" + c.cifra + ")" : ""}`;

export function construirPaquete(fecha: string, meals: Meal[], perfil: Perfil, periodo: "dia" | "semana" = "dia", extra: string[] = []): Paquete {
  const orden = [...meals].sort((a, b) => (a.fecha + a.hora).localeCompare(a.fecha + b.hora) || (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const lineas: string[] = [];
  const dias = [...new Set(orden.map((m) => m.fecha))];
  const jsonDias = dias.map((f) => {
    const ms = orden.filter((m) => m.fecha === f);
    const tot = totalesDia(ms);
    lineas.push(`${fechaLarga(f)}:`);
    const comidas = ms.map((m) => {
      const t = sumar(m.items);
      const corr = corregirComida(m, { perfil, dia: ms });
      lineas.push(`  ${tomaLabel(m.toma)} (${m.hora}): ${m.items.map((i) => `${i.nombre} ${Math.round(i.g)} g`).join(", ")}`);
      lineas.push(`    → ${fmt(t.kcal)} kcal, ${fmt(t.p)} g proteína, ${fmt(t.c)} g hidratos, ${fmt(t.fi)} g fibra, ${fmt(t.gr)} g grasa`);
      if (m.glucAntes != null || m.glucDespues != null) lineas.push(`    Glucosa: ${m.glucAntes ?? "—"} mg/dL antes · ${m.glucDespues ?? "—"} mg/dL a las 2 h`);
      if (m.nota) lineas.push(`    Nota: ${m.nota}`);
      for (const c of [...corr.filter((x) => x.tipo !== "ok"), ...(m.iaCorr ?? [])].slice(0, 4)) lineas.push(`    ${corrTxt(c)}`);
      const T = objetivoToma(m.toma, perfil);
      return {
        toma: m.toma, hora: m.hora, texto: m.texto,
        alimentos: m.items.map((i) => ({ nombre: i.nombre, gramos: Math.round(i.g), kcal: r1(i.por100.kcal * i.g / 100), proteina: r1(i.por100.p * i.g / 100), hidratos: r1(i.por100.c * i.g / 100), fibra: r1(i.por100.fi * i.g / 100), grasa: r1(i.por100.gr * i.g / 100), fuente: i.fuente })),
        totales: { kcal: Math.round(t.kcal), proteina: r1(t.p), hidratos: r1(t.c), fibra: r1(t.fi), grasa: r1(t.gr) },
        objetivoToma: { kcal: Math.round(T.kcal), proteina: T.p, hidratosMax: T.hc },
        glucosaAntes: m.glucAntes ?? null, glucosaDespues: m.glucDespues ?? null, nota: m.nota ?? null,
        correcciones: corr.map((c) => ({ tipo: c.tipo, texto: c.texto, porque: c.porque ?? null, cifra: c.cifra ?? null })),
      };
    });
    lineas.push(`  TOTAL: ${fmt(tot.kcal)} kcal de ${fmt(perfil.kcal)} · ${fmt(tot.p)} g proteína de ${perfil.prot} · ${fmt(tot.c)} g hidratos (${perfil.hcMin}–${perfil.hcMax}) · ${fmt(tot.fi)} g fibra de ${perfil.fibra}`);
    const rev = revisionDia(ms, perfil);
    for (const c of rev) lineas.push(`  ${corrTxt(c)}`);
    lineas.push("");
    return { fecha: f, comidas, totales: { kcal: Math.round(tot.kcal), proteina: r1(tot.p), hidratos: r1(tot.c), fibra: r1(tot.fi), grasa: r1(tot.gr) }, revision: rev.map((c) => ({ tipo: c.tipo, texto: c.texto })) };
  });
  if (extra.length) { lineas.push("Revisión:"); extra.forEach((e) => lineas.push(`  ${e}`)); }
  const cab = periodo === "semana" ? `Semana desde el ${fechaLarga(fecha)}` : fechaLarga(fecha);
  const texto = `Revisión de comidas de ${perfil.nombre} — ${cab}\nObjetivos: ${perfil.kcalMin}–${perfil.kcalMax} kcal, proteína ~${perfil.prot} g, hidratos ${perfil.hcMin}–${perfil.hcMax} g, fibra ≥ ${perfil.fibra} g\n\n${lineas.join("\n")}`.trim();
  const dia = { periodo, desde: fecha, objetivos: { kcal: perfil.kcal, proteina: perfil.prot, hidratos: [perfil.hcMin, perfil.hcMax], fibra: perfil.fibra }, dias: jsonDias, revision: extra };
  return { tipo: "mi-plato", fecha, context: `Revisión de comidas de ${perfil.nombre} del ${fecha}: ${texto}`, texto, dia };
}

export type Resultado = "webhook" | "atajo" | "compartido" | "copiado" | "cancelado";

export async function enviarWebhook(url: string, clave: string, p: Paquete): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(url, {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ context: p.context, tipo: p.tipo, fecha: p.fecha, dia: p.dia }),
    });
    window.clearTimeout(t);
    return res.ok;
  } catch {
    return false; // casi seguro CORS: se pasa al plan B sin asustar
  }
}

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export const esIOS = (): boolean => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export async function usarAtajo(nombre: string, p: Paquete): Promise<boolean> {
  const cuerpo = JSON.stringify({ context: p.context, tipo: p.tipo, fecha: p.fecha, dia: p.dia });
  if (!(await copiar(cuerpo))) return false;
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(nombre)}&input=clipboard`;
  return true;
}

export async function compartirTexto(p: Paquete): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: `Mi plato — ${p.fecha}`, text: p.texto });
    return true;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return true;
    return false;
  }
}

/** Orden de intentos: webhook → Atajo (si está activado, en iPhone) → compartir → copiar. */
export async function compartirConCoco(p: Paquete, cfg: { url: string; clave: string; atajo: string; usarAtajo: boolean }): Promise<Resultado> {
  if (cfg.url && cfg.clave && (await enviarWebhook(cfg.url, cfg.clave, p))) return "webhook";
  if (cfg.usarAtajo && cfg.atajo.trim() && esIOS() && (await usarAtajo(cfg.atajo.trim(), p))) return "atajo";
  if (await compartirTexto(p)) return "compartido";
  return (await copiar(p.texto)) ? "copiado" : "cancelado";
}
