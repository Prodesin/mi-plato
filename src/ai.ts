/* Capa de IA opcional (clave propia de Jorge, llamadas directas desde el navegador).
 * La clave solo vive en este dispositivo. La IA da una PRIMERA estimación: siempre se revisa a mano antes de guardar. */
import { buscarAlimento } from "./parser";
import { agruparTomas, topFrecuentes, totalesDia, REPARTO } from "./coach";
import type { Food, IG, Item, Meal, Perfil, Proveedor, Toma } from "./types";
import { itemTotales, sumar, tomaLabel } from "./types";
import { estimarFibra, fmt, uid } from "./util";

export type ProvInfo = { id: Proveedor; nombre: string; defecto: string; claveUrl: string; coste: string; nota: string };
export const PROVEEDORES: ProvInfo[] = [
  { id: "anthropic", nombre: "Claude (Anthropic) — recomendado", defecto: "claude-haiku-5-5", claveUrl: "https://console.anthropic.com/settings/keys", coste: "≈ 0,2–0,5 céntimos por análisis con foto (modelo Haiku)", nota: "Hace falta una clave de API de console.anthropic.com. La suscripción de Claude o de Claude Code NO sirve." },
  { id: "gemini", nombre: "Gemini (Google) — tiene nivel gratuito", defecto: "gemini-2.5-flash", claveUrl: "https://aistudio.google.com/apikey", coste: "Gratis dentro del límite diario; si lo superas, ≈ 0,1–0,3 céntimos por análisis", nota: "Clave gratuita desde Google AI Studio. En el nivel gratuito Google puede usar lo que envíes para mejorar sus productos." },
  { id: "xai", nombre: "xAI (Grok)", defecto: "grok-4.3", claveUrl: "https://console.x.ai", coste: "≈ 0,3–1 céntimo por análisis (según modelo)", nota: "Clave de API de console.x.ai." },
  { id: "openai", nombre: "OpenAI", defecto: "gpt-5-mini", claveUrl: "https://platform.openai.com/api-keys", coste: "≈ 0,1–0,4 céntimos por análisis con gpt-5-mini", nota: "Clave de API de platform.openai.com (la suscripción de ChatGPT no sirve)." },
];
export const provInfo = (id: Proveedor): ProvInfo => PROVEEDORES.find((p) => p.id === id) ?? PROVEEDORES[0];

export type Cfg = { proveedor: Proveedor; clave: string; modelo: string };

/* ---------------- Prompt ---------------- */
export const REGLA_PRINCIPAL = `REGLA PRINCIPAL DE PRODUCTO (manda sobre todo lo demás):
El usuario NO sabe de nutrición, y seguir menús es un lío porque casi siempre llevan cosas que no tienes en casa. Por tanto:
- La app NO impone menús, planes ni dietas. Parte SIEMPRE de lo que el usuario ya come y propone CAMBIOS PEQUEÑOS Y CONCRETOS con alimentos normales de casa y de supermercado (Mercadona, Eroski).
- Lenguaje llano de la calle, sin jerga técnica: nada de «índice glucémico», «macronutrientes», «hidratos netos», «densidad calórica» en los mensajes al usuario. Ejemplos del tono: «Mejor media barra que una entera», «Añade un yogur o un par de huevos», «Cambia el refresco por agua con gas», «Con medio plato de arroz vas bien», «Pon la ensalada primero y luego el resto».
- Cada sugerencia explica el porqué en UNA frase sencilla: «…así el azúcar te sube menos», «…así llegas a la proteína que necesitas para el músculo y te quedas saciado», «…tiene la mitad de calorías».
- Las cifras van como apoyo discreto (p. ej. «≈ 25 g de proteína» en pequeño), no como protagonista.
- Si propones qué comer, da 2-3 opciones SIMPLES con ingredientes básicos que suele haber en casa (huevos, atún en lata, pollo, yogur, queso fresco, legumbre de bote, verdura congelada, pan integral, fruta), priorizando alimentos que el usuario YA ha apuntado antes. Nada de recetas elaboradas. Cada opción en una línea, con el porqué en una frase.
- NO propongas menús, planes ni ingredientes raros.`;

export type CtxIA = { perfil: Perfil; hoy: Meal[]; historial: Meal[]; toma: Toma; hora: string };

export function promptSistema(c: CtxIA): string {
  const p = c.perfil;
  const tot = totalesDia(c.hoy);
  const frec = topFrecuentes(c.historial, 30).map((f) => f.nombre.toLowerCase());
  const resto = { kcal: Math.max(0, p.kcal - tot.kcal), p: Math.max(0, p.prot - tot.p) };
  const reparto = (Object.keys(REPARTO) as Toma[]).filter((t) => t !== "otro").map((t) => `${tomaLabel(t).toLowerCase()} ≈ ${fmt(p.kcal * REPARTO[t].frac)} kcal y ${REPARTO[t].p} g de proteína`).join("; ");
  return `Eres el coach de nutrición de ${p.nombre} dentro de una app llamada «Mi plato». Hablas siempre en español de España, tuteando, con tono cercano y directo.

${REGLA_PRINCIPAL}

PERFIL: ${p.altura} cm, ~${p.peso} kg, diabetes tipo 2, quiere perder grasa y ganar músculo. Vive en Lugo y compra en Mercadona y Eroski. Camina y hace sesiones cortas de fuerza.
OBJETIVOS DIARIOS: ${p.kcalMin}–${p.kcalMax} kcal (objetivo ${p.kcal}); proteína ~${p.prot} g (mínimo ${p.protMin}); hidratos ${p.hcMin}–${p.hcMax} g, máximo ~${p.hcComida} g por comida principal; fibra ≥ ${p.fibra} g; grasa ${p.grMin}–${p.grMax} g.
REPARTO ORIENTATIVO POR TOMA: ${reparto}.
HOY LLEVA: ${fmt(tot.kcal)} kcal, ${fmt(tot.p)} g de proteína, ${fmt(tot.c)} g de hidratos, ${fmt(tot.fi)} g de fibra. LE QUEDAN: ${fmt(resto.kcal)} kcal y ${fmt(resto.p)} g de proteína. Toma actual: ${tomaLabel(c.toma).toLowerCase()} (${c.hora}).
ALIMENTOS QUE COME HABITUALMENTE (top 30 de su historial): ${frec.length ? frec.join(", ") : "todavía no hay historial"}.

CÓMO ESTIMAR: usa raciones españolas reales (1 huevo ≈ 60 g, 1 rebanada de pan ≈ 30 g, 1 plato de lentejas ≈ 300 g cocinadas, 1 lata de atún ≈ 52 g escurrido, 1 vaso = 200 ml, 1 cucharada de aceite ≈ 10 g). No subestimes el aceite ni las salsas: si el plato suele llevarlos, inclúyelos como un item aparte o avisa en la nota. Valores nutricionales por la cantidad indicada (no por 100 g). Si dudas, marca confianza «baja». FIBRA: nunca pongas 0 por defecto; si no la sabes, estímala con lo que lleve (verdura, fruta, legumbre, integral, patata con piel…) o pon null. Un 0 solo es válido en carne, pescado, huevos, lácteos, aceites y bebidas.
CORRECCIONES: máximo 4, la más importante primero, concretas (qué añadir, quitar o cambiar y cuánto) y cada una con su porqué en una frase sencilla. Usa tipo «ok» cuando algo está bien.

Responde SOLO con un JSON válido, sin texto fuera de él, con exactamente esta forma:
{"items":[{"nombre":str,"gramos":num,"kcal":num,"proteina":num,"hidratos":num,"azucares":num,"fibra":num o null,"grasa":num,"ig":"bajo|medio|alto","confianza":"alta|media|baja","nota":str opcional}],"correcciones":[{"tipo":"ok|aviso|alerta","texto":str}],"resumen":str}
En «ig» indica cuánto sube el azúcar en sangre (bajo = poco, medio = algo, alto = mucho). «resumen» es una frase corta y amable.`;
}

/* ---------------- Llamadas ---------------- */
export class ErrorIA extends Error {}
const TIMEOUT_MS = 30000;

function mensajeHttp(status: number, cuerpo: string): string {
  if (status === 401 || status === 403) return "La clave no es válida o no tiene permiso. Revísala en Ajustes.";
  if (status === 429) return "Has llegado al límite de uso del proveedor (o no queda saldo). Prueba más tarde.";
  if (status === 404 || (status === 400 && /model/i.test(cuerpo))) return "El modelo no existe o no está disponible: pulsa «Cargar modelos» y elige otro.";
  if (status === 400) return "El proveedor no ha aceptado la petición (imagen demasiado grande o modelo sin visión).";
  if (status >= 500) return "El proveedor tiene problemas ahora mismo. Prueba en unos minutos.";
  return `El proveedor ha respondido con un error (${status}).`;
}

async function http(url: string, init: RequestInit): Promise<any> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const txt = await res.text();
    if (!res.ok) throw new ErrorIA(mensajeHttp(res.status, txt));
    try { return JSON.parse(txt); } catch { throw new ErrorIA("La respuesta del proveedor no se pudo leer."); }
  } catch (e) {
    if (e instanceof ErrorIA) throw e;
    if ((e as Error)?.name === "AbortError") throw new ErrorIA("Ha tardado más de 30 segundos. Inténtalo de nuevo.");
    throw new ErrorIA("No se pudo conectar: revisa la clave y tu conexión.");
  } finally {
    window.clearTimeout(t);
  }
}

const b64 = (dataUrl: string) => dataUrl.replace(/^data:[^;]+;base64,/, "");

/** Devuelve el texto (JSON) que contesta el modelo. */
export async function llamarIA(cfg: Cfg, sistema: string, usuario: string, imagenes: string[] = []): Promise<string> {
  const modelo = cfg.modelo.trim() || provInfo(cfg.proveedor).defecto;
  if (!cfg.clave.trim()) throw new ErrorIA("Falta la clave de API (Ajustes → Inteligencia artificial).");
  switch (cfg.proveedor) {
    case "anthropic": {
      const content: unknown[] = imagenes.map((d) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64(d) } }));
      content.push({ type: "text", text: usuario });
      const r = await http("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cfg.clave.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: modelo, max_tokens: 1800, system: sistema, messages: [{ role: "user", content }] }),
      });
      return (r.content ?? []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("");
    }
    case "gemini": {
      const parts: unknown[] = imagenes.map((d) => ({ inline_data: { mime_type: "image/jpeg", data: b64(d) } }));
      parts.push({ text: usuario });
      const r = await http(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.clave.trim() },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json" } }),
      });
      return (r.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join("");
    }
    case "xai":
    case "openai": {
      const url = cfg.proveedor === "xai" ? "https://api.x.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
      const content: unknown[] = [{ type: "text", text: usuario }, ...imagenes.map((d) => ({ type: "image_url", image_url: { url: d } }))];
      const r = await http(url, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${cfg.clave.trim()}` },
        body: JSON.stringify({ model: modelo, messages: [{ role: "system", content: sistema }, { role: "user", content }], response_format: { type: "json_object" } }),
      });
      return r.choices?.[0]?.message?.content ?? "";
    }
  }
}

export async function cargarModelos(cfg: Pick<Cfg, "proveedor" | "clave">): Promise<string[]> {
  if (!cfg.clave.trim()) throw new ErrorIA("Escribe primero la clave de API.");
  const k = cfg.clave.trim();
  if (cfg.proveedor === "anthropic") {
    const r = await http("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } });
    return (r.data ?? []).map((m: any) => String(m.id));
  }
  if (cfg.proveedor === "gemini") {
    const r = await http("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": k } });
    return (r.models ?? []).filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m: any) => String(m.name).replace(/^models\//, ""));
  }
  const url = cfg.proveedor === "xai" ? "https://api.x.ai/v1/models" : "https://api.openai.com/v1/models";
  const r = await http(url, { headers: { Authorization: `Bearer ${k}` } });
  const ids: string[] = (r.data ?? []).map((m: any) => String(m.id));
  return cfg.proveedor === "openai" ? ids.filter((i) => /^(gpt|o\d|chatgpt)/.test(i) && !/embed|audio|tts|whisper|image|realtime|transcribe|moderation/.test(i)) : ids;
}

export async function probarConexion(cfg: Cfg): Promise<void> {
  const txt = await llamarIA(cfg, "Responde únicamente con un JSON.", 'Responde solo con este JSON: {"ok":true}');
  if (!/ok/i.test(txt)) throw new ErrorIA("El proveedor ha respondido, pero algo raro: revisa el modelo.");
}

/* ---------------- Validación del esquema ---------------- */
export type IAItem = { nombre: string; gramos: number; kcal: number; proteina: number; hidratos: number; azucares: number; fibra: number; fibraEst?: boolean; grasa: number; ig: IG; confianza: "alta" | "media" | "baja"; nota?: string };
export type IACorr = { tipo: "ok" | "aviso" | "alerta"; texto: string };
export type IAResultado = { items: IAItem[]; correcciones: IACorr[]; resumen: string };

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}
export function extraerJson(txt: string): unknown {
  const limpio = txt.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(limpio); } catch { /* sigue */ }
  const a = limpio.indexOf("{");
  const b = limpio.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(limpio.slice(a, b + 1));
  throw new Error("sin JSON");
}
export function validarRespuesta(txt: string, permitirVacio = false): IAResultado {
  let o: any;
  try { o = extraerJson(txt); } catch { throw new ErrorIA("La IA no ha devuelto un formato que entienda."); }
  if (!o || typeof o !== "object" || !Array.isArray(o.items) || !Array.isArray(o.correcciones) || typeof o.resumen !== "string") throw new ErrorIA("La IA no ha devuelto un formato que entienda.");
  const items: IAItem[] = [];
  for (const x of o.items) {
    const gramos = num(x?.gramos), kcal = num(x?.kcal), p = num(x?.proteina), h = num(x?.hidratos), az = num(x?.azucares), fi0 = num(x?.fibra), gr = num(x?.grasa);
    if (typeof x?.nombre !== "string" || !x.nombre.trim() || gramos == null || gramos <= 0 || kcal == null || p == null || h == null || az == null || gr == null) throw new ErrorIA("La IA ha devuelto datos incompletos.");
    if (!["bajo", "medio", "alto"].includes(x.ig) || !["alta", "media", "baja"].includes(x.confianza)) throw new ErrorIA("La IA ha devuelto datos incompletos.");
    // fibra desconocida (falta, null o un 0 que no cuadra con tantos hidratos que no son azúcar): se estima y se marca, sin sumar un 0 engañoso
    const azc = Math.min(az, h);
    const fiDesconocida = fi0 == null || (fi0 === 0 && h - azc >= 10);
    const fi = fiDesconocida ? estimarFibra(h / gramos * 100, azc / gramos * 100) * gramos / 100 : Math.min(fi0, h);
    items.push({ nombre: x.nombre.trim(), gramos, kcal, proteina: p, hidratos: h, azucares: azc, fibra: fi, fibraEst: fiDesconocida && h >= 5 ? true : undefined, grasa: gr, ig: x.ig, confianza: x.confianza, nota: typeof x.nota === "string" ? x.nota : undefined });
  }
  if (!items.length && !permitirVacio) throw new ErrorIA("La IA no ha reconocido ningún alimento.");
  const correcciones: IACorr[] = [];
  for (const c of o.correcciones) {
    if (!c || typeof c.texto !== "string" || !["ok", "aviso", "alerta"].includes(c.tipo)) throw new ErrorIA("La IA ha devuelto datos incompletos.");
    correcciones.push({ tipo: c.tipo, texto: c.texto.trim() });
  }
  return { items, correcciones: correcciones.slice(0, 6), resumen: o.resumen.trim() };
}

/** Convierte la respuesta de la IA en items editables y cruza con la base local. */
export function itemsDeIA(r: IAResultado, catalogo: Food[]): Item[] {
  return r.items.map((x) => {
    const k = 100 / x.gramos;
    const it: Item = {
      id: uid(), foodId: null, nombre: x.nombre, g: Math.round(x.gramos),
      por100: { kcal: x.kcal * k, p: x.proteina * k, c: x.hidratos * k, az: x.azucares * k, fi: x.fibra * k, gr: x.grasa * k },
      ig: x.ig, cat: "otro", fuente: "ia", conf: x.confianza, nota: x.nota, fiEst: x.fibraEst,
    };
    const b = buscarAlimento(x.nombre, catalogo);
    if (b && b.score >= 0.8) {
      const f = b.food;
      it.cat = f.cat;
      const dif = f.kcal > 20 ? Math.abs(it.por100.kcal - f.kcal) / f.kcal : 0;
      const difP = f.p > 5 ? Math.abs(it.por100.p - f.p) / f.p : 0;
      if (dif > 0.35 || difP > 0.5) it.aviso = `La IA da ${fmt(it.por100.kcal)} kcal por 100 g y la base española ${fmt(f.kcal)} (${f.n}). Revisa la cantidad o usa el valor de la base.`;
      it.foodId = f.id;
    }
    return it;
  });
}

/* ---------------- Fotos ---------------- */
/** Reduce una foto a ~1024 px JPEG calidad 0,8. */
export async function reducirImagen(file: Blob, max = 1024): Promise<string> {
  const bmp: ImageBitmap | HTMLImageElement = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ErrorIA("No se pudo leer la foto.")); };
    img.src = url;
  });
  const w = (bmp as HTMLImageElement).naturalWidth, h = (bmp as HTMLImageElement).naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(bmp as CanvasImageSource, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/* ---------------- Operaciones ---------------- */
export async function analizarComida(cfg: Cfg, ctx: CtxIA, texto: string, imagenes: string[]): Promise<IAResultado> {
  const quien = texto.trim() ? `Esto es lo que ${ctx.perfil.nombre} dice que está comiendo (o va a comer): «${texto.trim()}».` : "Mira la foto y dime qué hay en el plato.";
  const usuario = `${quien}${imagenes.length ? " Te adjunto foto." : ""} Estima cada alimento con sus gramos y corrígele la comida con cambios pequeños y concretos.`;
  return validarRespuesta(await llamarIA(cfg, promptSistema(ctx), usuario, imagenes));
}

export async function revisionConIA(cfg: Cfg, ctx: CtxIA, resumen: string): Promise<IAResultado> {
  const usuario = `Este es el resumen (sin fotos) de lo que ha comido ${ctx.perfil.nombre}. Haz una revisión: qué ha ido bien, los errores que se repiten y 3 cambios pequeños y concretos para lo próximo. Deja «items» vacío.\n\n${resumen}`;
  return validarRespuesta(await llamarIA(cfg, promptSistema(ctx), usuario), true);
}

export function resumenTexto(meals: Meal[]): string {
  const dias = [...new Set(meals.map((m) => m.fecha))].sort();
  return dias.flatMap((f) => agruparTomas(meals.filter((m) => m.fecha === f))).map((m) => {
    const t = sumar(m.items);
    return `${m.fecha} ${m.hora} ${tomaLabel(m.toma)}: ${m.items.map((i) => `${i.nombre} ${Math.round(i.g)} g`).join(", ")} → ${fmt(t.kcal)} kcal, ${fmt(t.p)} g proteína, ${fmt(t.c)} g hidratos${m.glucDespues != null ? `, glucosa 2 h: ${m.glucDespues}` : ""}${m.nota ? ` (nota: ${m.nota})` : ""}`;
  }).join("\n");
}
export { itemTotales };
