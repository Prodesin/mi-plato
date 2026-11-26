/* Parser de texto libre en español: «dos huevos, una tostada de pan integral y café con leche».
 * Sin dependencias del DOM. Devuelve alimentos con gramos estimados (editables después en la revisión). */
import type { Food } from "./types";
import { norm, stem } from "./util";

export type Cantidad = { qty: number | null; unit: string | null; abs: number | null; factor: number };
export type ParsedItem = { texto: string; food: Food | null; g: number; def: boolean; cant: Cantidad; score: number };

const STOP = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "con", "a", "al", "en", "y", "e", "o", "para", "por", "lo", "mi", "que", "mas", "sin"]);
const NUM_WORDS: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20 };

/* Unidades: palabra (singular, normalizada) → clave canónica */
const UNIT_WORDS: Record<string, string> = {
  cucharada: "cucharada", cuchara: "cucharada", cda: "cucharada", cucharadas: "cucharada",
  cucharadita: "cucharadita", cdta: "cucharadita", cucharilla: "cucharadita",
  vaso: "vaso", vasito: "vaso", taza: "taza", tazon: "bol", bol: "bol", cuenco: "bol",
  plato: "plato", platito: "plato", racion: "racion", rebanada: "rebanada", tostada: "tostada", lata: "lata", latita: "lata",
  pieza: "pieza", unidad: "unidad", ud: "unidad", uds: "unidad", puñado: "puñado", punado: "puñado", loncha: "loncha", lonchita: "loncha",
  filete: "filete", barra: "barra", copa: "copa", trozo: "trozo", porcion: "porcion", pincho: "pincho", tajada: "tajada", rodaja: "rodaja",
  chorrito: "chorrito", chorro: "chorrito", chorreon: "chorrito", cacito: "cacito", scoop: "cacito", bote: "bote", tarrina: "tarrina",
  bolsa: "bolsa", bolsita: "bolsa", botellin: "botellin", brick: "brick", sobre: "sobre", tapa: "tapa", cuña: "cuna", cuna: "cuna", racimo: "racimo",
};
const GROUPS: string[][] = [["rebanada", "tostada"], ["porcion", "trozo", "pincho", "cuna", "tajada"], ["bol", "cuenco"], ["chorrito", "chorro"], ["cucharada", "cuchara"]];
const GENERIC_G: Record<string, number> = {
  cucharadita: 5, cucharada: 15, vaso: 200, taza: 200, bol: 250, plato: 250, puñado: 30, loncha: 20, rebanada: 30, tostada: 35, filete: 130,
  lata: 80, copa: 150, chorrito: 5, trozo: 100, porcion: 100, rodaja: 30, bote: 240, tarrina: 125, bolsa: 100, botellin: 200, brick: 200,
  sobre: 6, barra: 250, pincho: 100, cacito: 30, tajada: 200, tapa: 100, cuna: 30, racimo: 150,
};
/** Si solo dicen la unidad («dos tostadas»), alimento probable. */
const SOLO_UNIDAD: Record<string, string> = { tostada: "pan-blanco", rebanada: "pan-blanco", copa: "vino", barra: "pan-blanco" };

const SIZE_UP = new Set(["grande", "grandes", "enorme", "abundante", "generoso", "generosa", "buen", "buena", "bueno", "gran", "doble"]);
const SIZE_DOWN = new Set(["pequeño", "pequeña", "pequenos", "pequeno", "pequena", "pequenas", "chico", "chica", "mini", "ligero", "ligera", "justito", "justita", "poquito", "poquita", "escaso", "escasa"]);
const SIZE_NEUTRAL = new Set(["mediano", "mediana", "normal", "normalito", "normalita", "medianito"]);

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export function tokens(s: string): string[] {
  return norm(s).replace(/[,.;/]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);
}

/* ---------------- Índice de coincidencias ---------------- */
type Cand = { food: Food; toks: string[]; set: Set<string>; full: string };
export const fullKey = (s: string): string => norm(s).replace(/[,.;]+/g, " ").split(/\s+/).filter(Boolean).map(stem).join(" ");
let idxFoods: Food[] | null = null;
let idxLen = -1;
let idx: Cand[] = [];
function indexFor(catalog: Food[]): Cand[] {
  if (idxFoods === catalog && idxLen === catalog.length) return idx;
  const out: Cand[] = [];
  for (const food of catalog) {
    const names = [food.n.replace(/\s*\(.*?\)\s*/g, " "), ...food.syn];
    const seen = new Set<string>();
    for (const nm of names) {
      const toks = tokens(nm);
      const key = toks.join(" ");
      if (!toks.length || seen.has(key)) continue;
      seen.add(key);
      out.push({ food, toks, set: new Set(toks), full: fullKey(nm) });
    }
  }
  idxFoods = catalog; idxLen = catalog.length; idx = out;
  return out;
}

function tokMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 1) return true;
  return false;
}

function score(phrase: string[], cand: Cand): number {
  const p = phrase.length, c = cand.toks.length;
  if (!p || !c) return 0;
  const pset = new Set(phrase);
  let inter = 0;
  for (const t of cand.set) if (pset.has(t)) inter++;
  if (inter === cand.set.size && inter === pset.size) return p === c && phrase.join(" ") === cand.toks.join(" ") ? 1 : 0.98;
  if (inter === cand.set.size) return 0.55 + 0.4 * (c / p); // el candidato está dentro de lo escrito
  if (inter === pset.size) return 0.5 + 0.4 * (p / c); // lo escrito está dentro del candidato
  // difuso: errores de escritura de una letra
  let m = 0;
  for (const t of phrase) for (const ct of cand.toks) if (tokMatch(t, ct)) { m++; break; }
  if (m === 0) return 0;
  const frac = m / Math.max(p, c);
  if (m === c || m === p) return 0.45 + 0.4 * frac;
  return 0.2 + 0.4 * frac;
}

export function buscarAlimento(frase: string, catalog: Food[]): { food: Food; score: number; literal: boolean } | null {
  const ph = tokens(frase);
  if (!ph.length) return null;
  const fk = fullKey(frase);
  let best: { food: Food; score: number; literal: boolean } | null = null;
  for (const cand of indexFor(catalog)) {
    let s = score(ph, cand);
    if (s <= 0) continue;
    const literal = cand.full === fk;
    if (literal) s += 0.01;
    if (cand.food.fuente === "propio") s += 0.015;
    if (!best || s > best.score + 1e-9) best = { food: cand.food, score: s, literal };
  }
  return best;
}

/** Búsqueda para el buscador de alimentos (acepta prefijos). */
export function buscar(query: string, catalog: Food[], limit = 30): Food[] {
  const q = tokens(query);
  if (!q.length) return [];
  const res: { f: Food; s: number }[] = [];
  const seen = new Set<string>();
  for (const cand of indexFor(catalog)) {
    if (seen.has(cand.food.id) && res.length > limit * 4) continue;
    let s = score(q, cand);
    if (s < 0.5) {
      let ok = 0;
      for (const t of q) for (const ct of cand.toks) if (ct.startsWith(t) || (t.length >= 3 && ct.includes(t))) { ok++; break; }
      if (ok === q.length) s = 0.5 + 0.1 * (ok / cand.toks.length);
    }
    if (s >= 0.5) {
      const prev = res.find((r) => r.f.id === cand.food.id);
      if (prev) prev.s = Math.max(prev.s, s);
      else { res.push({ f: cand.food, s: s + (cand.food.fuente === "propio" ? 0.02 : 0) }); seen.add(cand.food.id); }
    }
  }
  return res.sort((a, b) => b.s - a.s).slice(0, limit).map((r) => r.f);
}

/* ---------------- Cantidades ---------------- */
function parseNumber(s: string): { n: number; rest: string } | null {
  let m = s.match(/^(\d+)\s*\/\s*(\d+)\b\s*/);
  if (m) return { n: parseInt(m[1], 10) / parseInt(m[2], 10), rest: s.slice(m[0].length) };
  m = s.match(/^(\d+(?:\.\d+)?)\s*/);
  if (m) return { n: parseFloat(m[1]), rest: s.slice(m[0].length) };
  return null;
}

type Q = { qty: number | null; unit: string | null; abs: number | null; factor: number; rest: string };

export function extraerCantidad(input: string): Q {
  let s = input.trim();
  let qty: number | null = null;
  let unit: string | null = null;
  let abs: number | null = null;
  let factor = 1;
  const mulQty = (n: number) => { qty = (qty ?? 1) * n; };
  // gramos/ml en cualquier posición («pechuga 200 g», «200 g de arroz»)
  const absRe = /(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|kilos?|g|gr|grs|gramos?|ml|cl|l|litros?)(?=\s|$)/;
  const am = s.match(absRe);
  if (am) {
    const n = parseFloat(am[1]);
    const u = am[2];
    abs = /^kg|^kilo/.test(u) ? n * 1000 : u === "cl" ? n * 10 : /^l$|^litro/.test(u) ? n * 1000 : n;
    s = (s.slice(0, am.index) + " " + s.slice(am.index! + am[0].length)).replace(/\s+/g, " ").trim();
  }
  // palabras de tamaño
  const words = s.split(" ");
  const kept: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (SIZE_UP.has(w)) { factor *= w === "doble" ? 2 : 1.3; continue; }
    if (SIZE_DOWN.has(w)) { factor *= 0.7; continue; }
    if (SIZE_NEUTRAL.has(w) && kept.length) { continue; }
    kept.push(w);
  }
  s = kept.join(" ");
  // pasadas: relleno, cantidad, unidad, «de»
  for (let pass = 0; pass < 4; pass++) {
    const before = s;
    s = s.replace(/^(unos|unas|como|casi|aprox\w*|sobre|mas o menos|alrededor de|tipo|mi|el|la|los|las)\s+/, "");
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:un\s+)?par(?:es)?\s+de\s+/))) { mulQty(2); s = s.slice(m[0].length); }
    else if ((m = s.match(/^(?:una\s+)?docena\s+(?:de\s+)?/))) { mulQty(12); s = s.slice(m[0].length); }
    else if ((m = s.match(/^(?:la\s+)?mitad\s+(?:de\s+)?(?:la\s+|el\s+|un\s+|una\s+)?/)) || (m = s.match(/^(?:medio|media)\s+(?:de\s+)?/))) { mulQty(0.5); s = s.slice(m[0].length); }
    else if ((m = s.match(/^tres cuartos\s+(?:de\s+)?/))) { mulQty(0.75); s = s.slice(m[0].length); }
    else if ((m = s.match(/^(?:un\s+)?cuarto\s+de\s+(?!pollo)/))) { mulQty(0.25); s = s.slice(m[0].length); }
    else if ((m = s.match(/^(?:un\s+)?(?:poco|poquito|poquita|pelin)\s+(?:de\s+)?/))) { factor *= 0.5; s = s.slice(m[0].length); }
    else if ((m = s.match(/^(?:bastante|mucho|mucha|muchos|muchas)\s+(?:de\s+)?/))) { factor *= 1.5; s = s.slice(m[0].length); }
    else {
      const num = parseNumber(s);
      if (num) {
        mulQty(num.n);
        s = num.rest.replace(/^x\s*/, "");
      } else {
        const w = s.split(" ")[0];
        if (w in NUM_WORDS && s.split(" ").length > 1) { mulQty(NUM_WORDS[w]); s = s.slice(w.length).trim(); }
      }
    }
    // unidad
    const w1 = s.split(" ")[0];
    const sing = w1 && (UNIT_WORDS[w1] ? w1 : UNIT_WORDS[stem(w1)] ? stem(w1) : w1.endsWith("es") && UNIT_WORDS[w1.slice(0, -2)] ? w1.slice(0, -2) : "");
    if (sing && UNIT_WORDS[sing]) {
      const rest = s.slice(w1.length).trim();
      const nextIsFood = /^(de|del)\s/.test(rest) || rest === "" || true;
      if (nextIsFood) {
        unit = UNIT_WORDS[sing];
        s = rest.replace(/^(?:de|del)\s+/, "");
        if (unit === "unidad") unit = null;
      }
    }
    if (s === before) break;
  }
  s = s.replace(/\bx\s*(\d+)\b/, (_m, n) => { mulQty(parseInt(n, 10)); return ""; }).replace(/\s+/g, " ").trim();
  return { qty, unit, abs, factor, rest: s };
}

function unitGroup(u: string): string[] {
  return GROUPS.find((g) => g.includes(u)) ?? [u];
}

/** Gramos de «una unidad» de este alimento. */
export function gramosUnidad(food: Food, unit: string | null, habitual?: number): number {
  if (unit === "racion") {
    const r = food.rac.find((x) => norm(x.sing).startsWith("racion"));
    if (r) return r.g;
  }
  if (!unit || unit === "racion" || unit === "pieza" || unit === "unidad") return habitual ?? food.rac[0]?.g ?? 100;
  const group = unitGroup(unit);
  const hit = (u: string) => food.rac.find((r) => norm(r.sing).split(" ")[0].replace(/ñ/g, "n") === u.replace(/ñ/g, "n"));
  const exact = hit(unit);
  if (exact) return exact.g;
  for (const u of group) { const r = hit(u); if (r) return r.g; }
  const liquid = food.cat === "bebida";
  if (unit === "lata") return liquid ? 330 : GENERIC_G.lata;
  if (unit === "copa") return liquid ? 150 : GENERIC_G.copa;
  return GENERIC_G[unit] ?? food.rac[0]?.g ?? 100;
}

export function calcGramos(food: Food, c: Cantidad, habituales?: Record<string, number>): number {
  if (c.abs != null) return Math.max(1, Math.round(c.abs));
  const hab = habituales?.[food.id];
  const useHab = hab && c.unit == null && c.qty == null && c.factor === 1 ? hab : undefined;
  const base = gramosUnidad(food, c.unit, useHab);
  const g = (c.qty ?? 1) * base * c.factor;
  return Math.max(1, Math.round(g));
}

/* ---------------- Parser principal ---------------- */
export type Opciones = { habituales?: Record<string, number> };

function parsePart(txt: string, catalog: Food[], exactOnly: boolean, opt: Opciones): ParsedItem | null {
  const original = txt.trim();
  const q = extraerCantidad(norm(original));
  let rest = q.rest;
  if (exactOnly && /^(con|y|e|mas)\s/.test(rest)) return null; // «2 tostadas con jamón»: la cantidad es de la tostada
  let food: Food | null = null;
  let sc = 0;
  if (!rest) {
    const sol = q.unit && SOLO_UNIDAD[q.unit];
    if (sol) { food = catalog.find((f) => f.id === sol) ?? null; sc = 0.6; }
    if (!food) return exactOnly ? null : { texto: original, food: null, g: 0, def: false, cant: { qty: q.qty, unit: q.unit, abs: q.abs, factor: q.factor }, score: 0 };
  } else {
    const b = buscarAlimento(rest, catalog);
    if (b && b.score >= (exactOnly ? 0.98 : 0.55) && (!exactOnly || b.literal)) { food = b.food; sc = b.score; }
    else if (exactOnly) return null;
  }
  const cant: Cantidad = { qty: q.qty, unit: q.unit, abs: q.abs, factor: q.factor };
  if (!food) return { texto: original, food: null, g: 0, def: false, cant, score: 0 };
  return {
    texto: original, food, score: sc, cant,
    g: calcGramos(food, cant, opt.habituales),
    def: q.qty == null && q.unit == null && q.abs == null && q.factor === 1,
  };
}

const CONECT = /\s+(?:con|y|e|mas|\+|&|junto con|ademas de)\s+/;

export function parseMeal(text: string, catalog: Food[], opt: Opciones = {}): ParsedItem[] {
  let t = norm(text)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\b(\d+|un|una|uno|dos|tres|cuatro)\s+y\s+medi[oa]\b/g, (_m, a: string) => String((/^\d+$/.test(a) ? parseInt(a, 10) : NUM_WORDS[a]) + 0.5))
    .replace(/\s+sin\s+[^,;\n+]+/g, "");
  t = t.replace(/^[-•*\s]+/gm, "");
  const out: ParsedItem[] = [];
  for (const seg of t.split(/[\n;,]+/).map((x) => x.trim()).filter(Boolean)) {
    // partes separadas por conectores, recordando cada conector
    const parts: { txt: string; conn: string }[] = [];
    const pieces = seg.split(new RegExp(`(${CONECT.source})`));
    let conn = "";
    for (let i = 0; i < pieces.length; i++) {
      if (i % 2 === 1) { conn = pieces[i]; continue; }
      if (pieces[i].trim()) parts.push({ txt: pieces[i].trim(), conn });
      conn = "";
    }
    let i = 0;
    while (i < parts.length) {
      let done = false;
      for (let j = Math.min(parts.length - 1, i + 3); j > i; j--) {
        const joined = parts.slice(i, j + 1).map((p, k) => (k ? p.conn : "") + p.txt).join("");
        const it = parsePart(joined, catalog, true, opt);
        if (it) { out.push(it); i = j + 1; done = true; break; }
      }
      if (done) continue;
      const it = parsePart(parts[i].txt, catalog, false, opt);
      if (it) out.push(it);
      i++;
    }
  }
  return out;
}
