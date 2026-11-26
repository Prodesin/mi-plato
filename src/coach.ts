/* Motor de reglas («coach»): corrige lo que Jorge come con cambios pequeños y concretos, con alimentos normales
 * de casa y de supermercado. Lenguaje llano; las cifras van solo como apoyo. No impone menús ni dietas.
 * Sin dependencias del DOM. */
import { FOODS_BY_ID, cantidadTexto, nombreCorto } from "./foods";
import type { Accion, Correccion, Food, Item, Meal, Perfil, Por100, Toma } from "./types";
import { itemTotales, sumar, tomaLabel, tomaPorHora } from "./types";
import { addDays, dowIndex, fmt, g as gtxt, kcal as ktxt, minutos, u } from "./util";

export type Catalogo = Map<string, Food>;
export const catalogoBase: Catalogo = FOODS_BY_ID;

/** Ids de la base que usa el motor (los comprueba tools/check-foods.mjs). */
export const COACH_IDS: string[] = [
  "atun-al-natural", "huevo", "yogur-de-proteinas", "queso-fresco-batido-0", "pechuga-de-pavo-en-lonchas", "jamon-cocido", "pechuga-de-pollo-a-la-plancha",
  "clara-de-huevo", "lentejas-cocidas", "ensalada-mixta", "verdura-variada", "agua", "pieza-de-fruta", "pan-integral", "pan-blanco", "pan-de-molde-blanco",
  "pan-de-molde-integral", "arroz-blanco-cocido", "arroz-integral-cocido", "pasta-cocida", "pasta-integral-cocida", "cereales-de-desayuno", "copos-de-avena",
  "patatas-fritas-caseras", "patata-cocida", "yogur-de-sabores", "yogur-natural", "patatas-fritas-de-bolsa", "frutos-secos-variados", "naranja", "aceite-de-oliva",
  "filete-empanado", "nuggets-de-pollo", "palitos-de-merluza-empanados", "merluza-a-la-plancha", "huevo-frito", "tortilla-francesa", "tomate", "nueces",
  "chocolate-negro", "sardinas-en-lata", "garbanzos-cocidos", "espinacas", "ternera-a-la-plancha", "salmon-a-la-plancha", "tortitas-de-maiz", "huevos-revueltos",
  "refresco-sin-azucar", "cerveza-sin-alcohol", "tortitas-de-arroz", "gambas-cocidas", "sepia-o-chipirones-a-la-plancha", "tortilla-de-verduras", "skyr",
];

type Ctx = { perfil: Perfil; dia: Meal[]; frecuentes?: string[]; catalogo?: Catalogo };

/* ------------------------------------------------------------------ */
/* Objetivos por toma                                                  */
/* ------------------------------------------------------------------ */
export const REPARTO: Record<Toma, { p: number; frac: number }> = {
  desayuno: { p: 30, frac: 0.25 },
  comida: { p: 40, frac: 0.35 },
  merienda: { p: 20, frac: 0.12 },
  cena: { p: 35, frac: 0.28 },
  otro: { p: 15, frac: 0.1 },
};
export const esPrincipal = (t: Toma): boolean => t === "desayuno" || t === "comida" || t === "cena";
export function objetivoToma(t: Toma, perfil: Perfil) {
  const r = REPARTO[t];
  return { kcal: perfil.kcal * r.frac, p: r.p, hc: esPrincipal(t) ? perfil.hcComida : Math.round(perfil.hcComida * 0.55) };
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const dec = (n: number, d = 0) => fmt(n, d);
const redondea5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const ordenTipo = { alerta: 0, aviso: 1, ok: 2 } as const;

function getFood(id: string, cat?: Catalogo): Food | undefined {
  return cat?.get(id) ?? FOODS_BY_ID.get(id);
}
function por100(f: Food) {
  return { kcal: f.kcal, p: f.p, c: f.c, az: f.az, fi: f.fi, gr: f.gr };
}
/** Crea un Item a partir de un alimento y unos gramos. */
export function itemDeAlimento(f: Food, gr: number, id: string): Item {
  return { id, foodId: f.id, nombre: f.n, g: Math.round(gr), por100: por100(f), ig: f.ig, cat: f.cat, fuente: f.fuente, def: false };
}

/** Racionaliza gramos de un alimento a algo que se pueda medir en casa (½ ración, 1, 1½...). */
function snap(f: Food, grams: number, min = 0.5, max = 3, enteros = false): number {
  const r = f.rac[0]?.g ?? 100;
  const paso = enteros && r <= 200 ? 1 : 2;
  const n = Math.min(max, Math.max(enteros && r <= 200 ? 1 : min, Math.round((grams / r) * paso) / paso));
  return Math.round(n * r);
}

const nombreMin = (it: Item): string => it.nombre.toLowerCase().replace(/\s+cocid[oa]s?$/, "");

/* ------------------------------------------------------------------ */
/* Sustituciones sencillas (de lo que sube mucho el azúcar o engorda)  */
/* ------------------------------------------------------------------ */
type Sust = { a: string; texto: (it: Item) => string; porque: string; factor?: number };
const SUST: Record<string, Sust> = {
  "pan-blanco": { a: "pan-integral", texto: () => "Cambia el pan blanco por pan integral", porque: "Así el azúcar te sube menos y llevas más fibra." },
  "pan-de-molde-blanco": { a: "pan-de-molde-integral", texto: () => "Cambia el pan de molde por pan de molde integral", porque: "Así el azúcar te sube menos y te sacia más." },
  "arroz-blanco-cocido": { a: "arroz-integral-cocido", texto: () => "Mejor arroz integral que blanco", porque: "Así el azúcar te sube menos y te quedas más saciado." },
  "pasta-cocida": { a: "pasta-integral-cocida", texto: () => "Cambia la pasta por pasta integral", porque: "Así el azúcar te sube menos y te sacia más." },
  "cereales-de-desayuno": { a: "copos-de-avena", factor: 0.8, texto: () => "Cambia los cereales de caja por copos de avena", porque: "Llevan mucho menos azúcar y te sacian más." },
  "patatas-fritas-caseras": { a: "patata-cocida", factor: 1.2, texto: () => "Mejor patata cocida o al horno que frita", porque: "Tiene bastantes menos calorías y te sacia igual." },
  "yogur-de-sabores": { a: "yogur-natural", texto: () => "Cambia el yogur de sabores por uno natural (o de proteínas)", porque: "Lleva mucho menos azúcar." },
  "patatas-fritas-de-bolsa": { a: "frutos-secos-variados", factor: 0.6, texto: () => "Cambia las patatas de bolsa por un puñado de frutos secos", porque: "Te sacian más y el azúcar te sube menos." },
  "tortitas-de-arroz": { a: "pan-integral", factor: 3, texto: () => "Cambia las tortitas de arroz por una rebanada de pan integral", porque: "Así el azúcar te sube menos y te sacia más." },
  "filete-empanado": { a: "pechuga-de-pollo-a-la-plancha", factor: 1, texto: () => "Mejor a la plancha que empanado", porque: "Tiene casi la mitad de calorías y más proteína." },
  "nuggets-de-pollo": { a: "pechuga-de-pollo-a-la-plancha", factor: 1, texto: () => "Cambia los nuggets por pechuga a la plancha", porque: "Tiene menos calorías y más proteína." },
  "palitos-de-merluza-empanados": { a: "merluza-a-la-plancha", factor: 1, texto: () => "Mejor merluza a la plancha que empanada", porque: "Tiene la mitad de calorías y más proteína." },
  "huevo-frito": { a: "huevo", factor: 1.1, texto: () => "Mejor el huevo cocido o a la plancha que frito", porque: "Tiene bastantes menos calorías." },
};

const CAT_BOLLERIA = new Set(["bolleria"]);
const SUBIDA_AZUCAR_IDS = new Set(["refresco-azucarado", "zumo-de-naranja", "batido-de-chocolate", "bebida-energetica", "agua-tonica", "horchata", "chocolate-a-la-taza", "combinado"]);
const ALCOHOL_IDS = new Set(["cerveza", "vino", "sidra", "destilado", "combinado"]);
const CAT_CARBS = new Set(["pan", "arroz", "pasta", "patata", "cereal", "plato", "bolleria", "fruta", "legumbre", "dulce", "snack"]);
const VERDE = new Set(["verdura"]);

/* ------------------------------------------------------------------ */
/* Corrección de una comida                                            */
/* ------------------------------------------------------------------ */
export function corregirComida(meal: { items: Item[]; toma: Toma; hora: string }, ctx: Ctx): Correccion[] {
  const items = meal.items.filter((i) => i.g > 0);
  if (!items.length) return [];
  const { perfil } = ctx;
  const cat = ctx.catalogo;
  const tot = sumar(items);
  const T = objetivoToma(meal.toma, perfil);
  const principal = esPrincipal(meal.toma);
  const out: Correccion[] = [];
  const push = (c: Omit<Correccion, "origen">) => out.push({ ...c, origen: "reglas" });
  const tocados = new Set<string>();
  const frec = new Set(ctx.frecuentes ?? []);

  /* 1. Bebidas con azúcar */
  for (const it of items) {
    const az = itemTotales(it).az;
    const esBebida = it.cat === "bebida" || SUBIDA_AZUCAR_IDS.has(it.foodId ?? "");
    if (!esBebida || az < 10 || (it.foodId && ALCOHOL_IDS.has(it.foodId) && it.foodId !== "combinado")) continue;
    const kc = itemTotales(it).kcal;
    tocados.add(it.id);
    if (it.foodId === "zumo-de-naranja" || /zumo/i.test(it.nombre)) {
      const nar = getFood("naranja", cat);
      push({
        tipo: "aviso", prio: 9,
        texto: "Cambia el zumo por la naranja entera",
        porque: "Es la misma fruta, con más fibra, y el azúcar te sube menos.",
        cifra: `≈ ${u(az, "g")} de azúcar en el zumo`,
        accion: nar ? { t: "cambiar", itemId: it.id, foodId: nar.id, g: 150 * Math.max(1, Math.round(it.g / 200)) } : undefined,
      });
    } else {
      const sin = /cola|refresc|fanta|pepsi|sprite|kas|casera|tonic/i.test(it.nombre);
      push({
        tipo: "alerta", prio: 10,
        texto: sin ? `Cambia ${nombreMin(it) === "refresco azucarado" ? "el refresco" : "la bebida"} por agua con gas (o por uno sin azúcar)` : "Cambia esa bebida por agua, café o infusión",
        porque: "Así te ahorras el azúcar y las calorías sin notar que comes menos.",
        cifra: `≈ ${u(az, "g")} de azúcar · ${ktxt(kc)}`,
        accion: getFood("agua", cat) ? { t: "cambiar", itemId: it.id, foodId: "agua", g: it.g } : undefined,
      });
    }
    break;
  }

  /* 2. Alcohol */
  const alc = items.find((i) => i.foodId && ALCOHOL_IDS.has(i.foodId) && itemTotales(i).kcal >= 90);
  if (alc && !tocados.size) {
    tocados.add(alc.id);
    const sin = alc.foodId === "cerveza";
    push({
      tipo: "aviso", prio: 7,
      texto: sin ? "Mejor una cerveza sin alcohol o agua con gas" : "Mejor agua con gas, o una sola copa",
      porque: "El alcohol suma calorías y no te sacia nada.",
      cifra: `≈ ${ktxt(itemTotales(alc).kcal)}`,
      accion: sin && getFood("cerveza-sin-alcohol", cat) ? { t: "cambiar", itemId: alc.id, foodId: "cerveza-sin-alcohol", g: alc.g } : undefined,
    });
  }

  /* 3. Demasiados hidratos (pan, arroz, pasta, patata, fruta…) */
  let carbItem: Item | null = null;
  if (tot.c > T.hc * 1.04 && tot.c > 20) {
    const candidatos = items
      .filter((i) => CAT_CARBS.has(i.cat) && !tocados.has(i.id) && i.por100.c >= 12 && !(i.ig === "bajo" && i.por100.fi / Math.max(i.por100.c, 1) >= 0.25))
      .sort((a, b) => itemTotales(b).c - itemTotales(a).c);
    carbItem = candidatos[0] ?? null;
    if (carbItem) {
      const cIt = itemTotales(carbItem).c;
      const objetivo = Math.max(T.hc - 5, 15);
      const exceso = tot.c - objetivo;
      const nuevaFrac = Math.max(0.25, Math.min(0.85, 1 - exceso / cIt));
      const food = (carbItem.foodId && getFood(carbItem.foodId, cat)) || undefined;
      let nuevoG = Math.max(5, Math.round((carbItem.g * nuevaFrac) / 5) * 5);
      if (food) nuevoG = Math.max(5, snap(food, carbItem.g * nuevaFrac, 0.25, 6));
      if (nuevoG >= carbItem.g) nuevoG = Math.max(5, Math.round((carbItem.g * 0.75) / 5) * 5);
      const queda = tot.c - (cIt * (carbItem.g - nuevoG)) / carbItem.g;
      const cant = food ? cantidadTexto(food, nuevoG) : `${nuevoG} g de ${nombreMin(carbItem)}`;
      tocados.add(carbItem.id);
      push({
        tipo: tot.c > T.hc * 1.35 ? "alerta" : "aviso", prio: 9.5,
        texto: queda <= T.hc * 1.1 ? `Con ${cant} vas bien` : `Baja a ${cant}: es lo que más hidratos lleva`,
        porque: "Así el azúcar te sube menos y no te da el bajón después.",
        cifra: `de ${u(carbItem.g, "g")} a ${u(nuevoG, "g")} → te quedas en ≈ ${u(queda, "g")} de hidratos`,
        accion: { t: "gramos", itemId: carbItem.id, g: nuevoG },
      });
    } else {
      push({
        tipo: "aviso", prio: 8,
        texto: "Lleva muchos hidratos (pan, arroz, pasta, patata, fruta…): quita un poco de lo más harinoso",
        porque: "Así el azúcar te sube menos.",
        cifra: `≈ ${u(tot.c, "g")} de hidratos; con unos ${u(T.hc, "g")} vas bien`,
      });
    }
  }

  /* 4. Paseo tras comer */
  if ((meal.toma === "comida" || meal.toma === "cena") && tot.c >= 40) {
    push({
      tipo: "aviso", prio: 5,
      texto: "Al terminar, date un paseo de 10-15 minutos",
      porque: "Así el azúcar te baja antes.",
    });
  }

  /* 5. Proteína baja */
  const deficit = T.p - tot.p;
  const umbral = principal ? 10 : 8;
  if (deficit >= umbral) {
    const opciones = candidatosProteina(meal.toma, items, deficit, tot.kcal, T.kcal, frec, cat);
    if (opciones.length) {
      const [a, b] = opciones;
      const textoA = cantidadTexto(a.food, a.g);
      const textoB = b ? cantidadTexto(b.food, b.g) : "";
      push({
        tipo: tot.p < T.p * 0.5 ? "alerta" : "aviso", prio: 10,
        texto: `Añade ${textoA}${b ? ` (o ${textoB})` : ""}`,
        porque: principal ? "Así llegas a la proteína que necesitas para el músculo y te quedas saciado." : "Así aguantas mejor hasta la siguiente comida y cuidas el músculo.",
        cifra: `≈ ${u(a.p, "g")} de proteína · ahora llevas ${u(tot.p, "g")}`,
        accion: { t: "anadir", foodId: a.food.id, g: a.g },
      });
    }
  }

  /* 6. Cambios sencillos por lo que sube mucho el azúcar o lo frito */
  for (const it of items) {
    if (tocados.has(it.id) || out.length >= 8) continue;
    const s = it.foodId ? SUST[it.foodId] : undefined;
    if (s && getFood(s.a, cat)) {
      const alimento = getFood(s.a, cat)!;
      const gNuevo = Math.max(5, Math.round((it.g * (s.factor ?? 1)) / 5) * 5);
      const kAntes = itemTotales(it).kcal;
      const kDespues = (alimento.kcal * gNuevo) / 100;
      tocados.add(it.id);
      push({
        tipo: "aviso", prio: it.ig === "alto" ? 7 : 6,
        texto: s.texto(it),
        porque: s.porque,
        cifra: Math.abs(kAntes - kDespues) > 40 ? `≈ ${kAntes > kDespues ? "−" : "+"}${ktxt(Math.abs(kAntes - kDespues))}` : undefined,
        accion: { t: "cambiar", itemId: it.id, foodId: alimento.id, g: gNuevo },
      });
      continue;
    }
    if (CAT_BOLLERIA.has(it.cat) && itemTotales(it).kcal >= 120 && getFood("pan-integral", cat)) {
      tocados.add(it.id);
      push({
        tipo: "aviso", prio: 7,
        texto: "Mejor una tostada de pan integral con tomate y aceite que bollería",
        porque: "Te sacia más y el azúcar te sube menos.",
        cifra: `≈ ${ktxt(itemTotales(it).kcal)} la bollería`,
        accion: { t: "cambiar", itemId: it.id, foodId: "pan-integral", g: 60 },
      });
    } else if (it.cat === "dulce" && itemTotales(it).kcal >= 140 && !/azucar|miel|mermelada|cola cao|crema de cacao/i.test(it.nombre)) {
      tocados.add(it.id);
      push({
        tipo: "aviso", prio: 6,
        texto: "Si te apetece dulce, mejor un yogur o un par de onzas de chocolate negro",
        porque: "Te sacia más y el azúcar te sube menos.",
        cifra: `≈ ${ktxt(itemTotales(it).kcal)}`,
      });
    }
  }
  /* Cosas que suben mucho el azúcar sin sustitución conocida */
  const altoSinSust = items.find((i) => !tocados.has(i.id) && i.ig === "alto" && itemTotales(i).c >= 30 && i !== carbItem);
  if (altoSinSust && !out.some((o) => o.prio && o.prio >= 9.5)) {
    tocados.add(altoSinSust.id);
    push({
      tipo: "aviso", prio: 5.5,
      texto: `${nombreMin(altoSinSust)[0].toUpperCase()}${nombreMin(altoSinSust).slice(1)} te sube mucho el azúcar: toma algo menos o acompáñalo con verdura y proteína`,
      porque: "Así el azúcar sube más despacio.",
      cifra: `≈ ${u(itemTotales(altoSinSust).c, "g")} de hidratos`,
    });
  }

  /* 7. Verdura / fibra en comida y cena */
  const verduraG = items.filter((i) => VERDE.has(i.cat) || i.cat === "legumbre").reduce((s, i) => s + i.g, 0);
  if ((meal.toma === "comida" || meal.toma === "cena") && verduraG < 80 && tot.fi < 6) {
    const f = elegirVerdura(frec, cat);
    if (f) {
      const gg = snap(f, 180, 0.5, 2);
      push({
        tipo: "aviso", prio: 6.5,
        texto: `Añade ${cantidadTexto(f, gg)}`,
        porque: "Te sacia más y el azúcar te sube menos.",
        cifra: `≈ ${u((f.fi * gg) / 100, "g")} de fibra`,
        accion: { t: "anadir", foodId: f.id, g: gg },
      });
    }
  }

  /* 8. Muy grande */
  const limite = meal.toma === "merienda" ? 350 : meal.toma === "otro" ? 300 : meal.toma === "desayuno" ? 600 : 850;
  if (tot.kcal > Math.max(limite, T.kcal * 1.35)) {
    const calorico = [...items]
      .filter((i) => !tocados.has(i.id) && !/pechuga|merluza|atun|pavo|clara|yogur de prote|ensalada|verdura/i.test(i.nombre))
      .sort((a, b) => itemTotales(b).kcal - itemTotales(a).kcal)[0];
    const kc = calorico ? itemTotales(calorico).kcal : 0;
    if (calorico && kc > 150) {
      const f = calorico.foodId ? getFood(calorico.foodId, cat) : undefined;
      const mitad = Math.max(5, Math.round(calorico.g / 2 / 5) * 5);
      tocados.add(calorico.id);
      push({
        tipo: "aviso", prio: 8.5,
        texto: `Es una comida bastante cargada: toma la mitad de ${f ? nombreCorto(f) : nombreMin(calorico)}`,
        porque: "Así tiene bastantes menos calorías y sigues comiendo de todo.",
        cifra: `≈ ${ktxt(tot.kcal)} ahora · −${ktxt(kc / 2)}`,
        accion: { t: "gramos", itemId: calorico.id, g: mitad },
      });
    } else {
      push({
        tipo: "aviso", prio: 6,
        texto: "Es una comida bastante cargada para esta hora del día",
        porque: "Si puedes, que la siguiente sea más ligera.",
        cifra: `≈ ${ktxt(tot.kcal)}`,
      });
    }
  }

  /* 9. Cena tardía y fuerte */
  if (minutos(meal.hora) >= 21 * 60 + 30 && tot.kcal > 600 && meal.toma === "cena") {
    push({ tipo: "aviso", prio: 4, texto: "Cena tarde y fuerte: otro día, algo más ligero", porque: "Duermes mejor y te levantas con más hambre sana.", cifra: `≈ ${ktxt(tot.kcal)}` });
  }

  /* 10. ¿Lleva aceite? */
  const grasaVisible = items.some((i) => i.foodId === "aceite-de-oliva" || i.foodId === "mantequilla" || i.foodId === "mayonesa" || i.cat === "grasa" || /aguacate|frutos secos|nueces|almendras/i.test(i.nombre));
  const seCocina = items.some((i) => /plancha|fritos?|saltead|asad|ensalada|verdura|pulpo|pisto|pimiento|champi/i.test(i.nombre) || i.cat === "verdura");
  if (!grasaVisible && seCocina && (meal.toma === "comida" || meal.toma === "cena")) {
    const ac = getFood("aceite-de-oliva", cat);
    push({
      tipo: "aviso", prio: 3,
      texto: "¿Lleva aceite? Apúntalo",
      porque: "Es lo que más se olvida y suma sin que se note.",
      cifra: "1 cucharada ≈ 90 kcal",
      accion: ac ? { t: "anadir", foodId: ac.id, g: 10 } : undefined,
    });
  }

  /* Orden de comida */
  if ((meal.toma === "comida" || meal.toma === "cena") && tot.c >= 35 && verduraG >= 80 && items.some((i) => i.por100.p >= 15)) {
    push({
      tipo: "aviso", prio: 2,
      texto: "Empieza por la ensalada o la verdura y la proteína, y deja el pan o el arroz para el final",
      porque: "Así el azúcar te sube menos.",
    });
  }

  /* Positivos */
  const oks: Omit<Correccion, "origen">[] = [];
  const sinProblemas = !out.some((c) => c.tipo !== "ok");
  const pBuena = deficit < umbral && tot.p >= (principal ? 20 : 10);
  const cBuena = tot.c <= T.hc * 1.04;
  if (sinProblemas && pBuena && cBuena) {
    oks.push({ tipo: "ok", prio: 5, texto: "Bien equilibrada", porque: "Buena proteína y los hidratos bien medidos.", cifra: `${u(tot.p, "g")} de proteína y ${u(tot.c, "g")} de hidratos` });
  } else {
    if (pBuena) oks.push({ tipo: "ok", prio: 3, texto: "Buena proteína: te vas a quedar saciado", cifra: u(tot.p, "g") });
    if (cBuena && tot.c > 8 && principal) oks.push({ tipo: "ok", prio: 2, texto: "Los hidratos van bien medidos", cifra: u(tot.c, "g") });
  }
  if (verduraG >= 100 && sinProblemas) oks.push({ tipo: "ok", prio: 1, texto: "Llevas verdura: te sacia y el azúcar te sube menos" });
  for (const o of oks) push(o);

  out.sort((a, b) => ordenTipo[a.tipo] - ordenTipo[b.tipo] || (b.prio ?? 0) - (a.prio ?? 0));
  const res = out.slice(0, 4);
  // con avisos, intenta dejar al menos un mensaje positivo
  if (!res.some((c) => c.tipo === "ok")) {
    const ok = out.find((c) => c.tipo === "ok");
    if (ok && res.length >= 4) res[3] = ok;
  }
  return res;
}

const PROT_DEFECTO: Record<Toma, string[]> = {
  desayuno: ["huevo", "yogur-de-proteinas", "queso-fresco-batido-0", "pechuga-de-pavo-en-lonchas", "jamon-cocido", "skyr"],
  comida: ["atun-al-natural", "pechuga-de-pollo-a-la-plancha", "huevo", "gambas-cocidas", "queso-fresco-batido-0"],
  merienda: ["yogur-de-proteinas", "queso-fresco-batido-0", "pechuga-de-pavo-en-lonchas", "atun-al-natural", "skyr"],
  cena: ["atun-al-natural", "huevo", "pechuga-de-pollo-a-la-plancha", "queso-fresco-batido-0", "gambas-cocidas", "pechuga-de-pavo-en-lonchas"],
  otro: ["yogur-de-proteinas", "queso-fresco-batido-0", "huevo"],
};
const ES_PROTEINA = new Set(["carne", "pescado", "huevo", "embutido", "lacteo", "legumbre", "suplemento"]);

function candidatosProteina(toma: Toma, items: Item[], deficit: number, kcalAct: number, kcalObj: number, frec: Set<string>, cat?: Catalogo) {
  const ya = new Set(items.map((i) => i.foodId));
  const ids = [...PROT_DEFECTO[toma]];
  // lo que Jorge ya come y es rico en proteína va primero
  for (const id of frec) {
    const f = getFood(id, cat);
    if (f && ES_PROTEINA.has(f.cat) && f.p >= 10 && f.c < 10 && f.kcal < 260 && !ids.includes(id)) ids.unshift(id);
  }
  const res: { food: Food; g: number; p: number; score: number }[] = [];
  for (const id of ids) {
    const f = getFood(id, cat);
    if (!f || ya.has(f.id)) continue;
    const r = f.rac[0]?.g ?? 100;
    const necesario = (deficit / Math.max(f.p, 1)) * 100;
    let g = snap(f, necesario, 0.5, 3, true);
    if (g < r * 0.5) g = Math.round(r * 0.5);
    if (g > r * 2.6) continue;
    const p = (f.p * g) / 100;
    const kc = (f.kcal * g) / 100;
    let score = -Math.abs(p - deficit) / Math.max(deficit, 1);
    if (kcalAct + kc > kcalObj * 1.4) score -= 0.8;
    if (frec.has(f.id)) score += 0.5;
    res.push({ food: f, g, p, score });
  }
  res.sort((a, b) => b.score - a.score);
  const top = res.slice(0, 2);
  // evita dos opciones del mismo tipo
  if (top.length === 2 && top[0].food.cat === top[1].food.cat && res[2]) top[1] = res[2];
  return top;
}

function elegirVerdura(frec: Set<string>, cat?: Catalogo): Food | undefined {
  for (const id of frec) {
    const f = getFood(id, cat);
    if (f && f.cat === "verdura" && f.kcal < 100) return f;
  }
  return getFood("ensalada-mixta", cat);
}

/* ------------------------------------------------------------------ */
/* El día en marcha                                                    */
/* ------------------------------------------------------------------ */
export function totalesDia(meals: Meal[]): Por100 {
  return sumar(meals.flatMap((m) => m.items));
}
export const TOMAS_DIA: Toma[] = ["desayuno", "comida", "merienda", "cena"];

/** Siguiente toma sin apuntar a partir de la hora actual. */
export function siguienteToma(meals: Meal[], ahora: string): Toma {
  const hechas = new Set(meals.map((m) => m.toma));
  const ini = TOMAS_DIA.indexOf(tomaPorHora(ahora));
  for (let k = 0; k < TOMAS_DIA.length; k++) {
    const t = TOMAS_DIA[(ini + k) % TOMAS_DIA.length];
    if (k > 0 && TOMAS_DIA.indexOf(t) < ini) break;
    if (!hechas.has(t)) return t;
  }
  return tomaPorHora(ahora);
}
export const paraToma = (t: Toma): string => (t === "otro" ? "lo que queda de día" : `${t === "comida" || t === "merienda" || t === "cena" ? "la" : "el"} ${t}`);

export function fraseRestante(perfil: Perfil, tot: Por100, toma: Toma | null, hayComidas: boolean): string {
  if (!hayComidas) return "Apunta lo que comas y te lo voy corrigiendo.";
  const k = perfil.kcal - tot.kcal;
  const p = perfil.prot - tot.p;
  const para = toma ? ` para ${paraToma(toma)}` : "";
  if (k <= -100) return `Hoy te has pasado unas ${ktxt(-k)}: sin dramas, que la siguiente comida sea ligera${p > 20 ? ` y con ${u(p, "g")} más de proteína` : ""}.`;
  if (k < 80) return p > 15 ? `Ya has cubierto las calorías del día; te faltan ${u(p, "g")} de proteína: mejor algo ligero y rico en proteína.` : "Ya has cubierto el día. Si te entra hambre: infusión, yogur natural o una fruta.";
  const prot = p > 5 ? ` y ${u(p, "g")} de proteína` : "";
  return `Te quedan ${ktxt(k)}${prot}${para}.${p <= 5 ? " La proteína, ya cubierta." : ""}`;
}

/* ---- Qué comer ahora ---- */
type Plato = { titulo: string; tomas: Toma[]; items: [string, number][]; clave: string };
const PLATOS: Plato[] = [
  { titulo: "Yogur de proteínas con un puñado de nueces", tomas: ["desayuno", "merienda"], clave: "yogur-de-proteinas", items: [["yogur-de-proteinas", 160], ["nueces", 20]] },
  { titulo: "Dos huevos revueltos con una tostada de pan integral", tomas: ["desayuno"], clave: "huevo", items: [["huevos-revueltos", 120], ["pan-integral", 35]] },
  { titulo: "Tostada de pan integral con pavo y tomate", tomas: ["desayuno", "merienda"], clave: "pavo", items: [["pan-integral", 35], ["pechuga-de-pavo-en-lonchas", 45], ["tomate", 80]] },
  { titulo: "Queso fresco batido con fruta y unas nueces", tomas: ["desayuno", "merienda"], clave: "queso-batido", items: [["queso-fresco-batido-0", 125], ["pieza-de-fruta", 150], ["nueces", 15]] },
  { titulo: "Yogur natural con copos de avena y fruta", tomas: ["desayuno"], clave: "yogur-natural", items: [["yogur-natural", 125], ["copos-de-avena", 30], ["pieza-de-fruta", 100]] },
  { titulo: "Una lata de atún con unas tortitas de maíz", tomas: ["merienda"], clave: "atun", items: [["atun-al-natural", 52], ["tortitas-de-maiz", 24]] },
  { titulo: "Un puñado de frutos secos y una fruta", tomas: ["merienda", "otro"], clave: "frutos-secos", items: [["frutos-secos-variados", 25], ["pieza-de-fruta", 150]] },
  { titulo: "Tortilla de 2 huevos con jamón cocido", tomas: ["desayuno", "merienda"], clave: "huevo", items: [["tortilla-francesa", 120], ["jamon-cocido", 40]] },
  { titulo: "Tortilla de 2 huevos con ensalada", tomas: ["comida", "cena"], clave: "huevo", items: [["tortilla-francesa", 120], ["ensalada-mixta", 200], ["aceite-de-oliva", 5]] },
  { titulo: "Dos latas de atún con tomate y un poco de pan integral", tomas: ["comida", "cena"], clave: "atun", items: [["atun-al-natural", 104], ["tomate", 200], ["pan-integral", 30], ["aceite-de-oliva", 5]] },
  { titulo: "Pechuga de pollo a la plancha con verdura", tomas: ["comida", "cena"], clave: "pollo", items: [["pechuga-de-pollo-a-la-plancha", 150], ["verdura-variada", 250], ["aceite-de-oliva", 5]] },
  { titulo: "Lentejas de bote con verdura y un huevo", tomas: ["comida", "cena"], clave: "lentejas", items: [["lentejas-cocidas", 250], ["verdura-variada", 150], ["huevo", 60]] },
  { titulo: "Merluza a la plancha con ensalada y una patata cocida", tomas: ["comida", "cena"], clave: "merluza", items: [["merluza-a-la-plancha", 180], ["ensalada-mixta", 200], ["patata-cocida", 150], ["aceite-de-oliva", 5]] },
  { titulo: "Pavo en lonchas con queso fresco y ensalada", tomas: ["cena", "comida"], clave: "pavo", items: [["pechuga-de-pavo-en-lonchas", 100], ["queso-fresco-batido-0", 100], ["ensalada-mixta", 200], ["pan-integral", 30]] },
  { titulo: "Sardinas de lata con tomate y pan integral", tomas: ["comida", "cena"], clave: "sardinas", items: [["sardinas-en-lata", 65], ["tomate", 200], ["pan-integral", 30]] },
  { titulo: "Garbanzos de bote con espinacas y un huevo", tomas: ["comida", "cena"], clave: "garbanzos", items: [["garbanzos-cocidos", 200], ["espinacas", 150], ["huevo", 60], ["aceite-de-oliva", 5]] },
  { titulo: "Ternera a la plancha con ensalada", tomas: ["comida", "cena"], clave: "ternera", items: [["ternera-a-la-plancha", 150], ["ensalada-mixta", 200], ["aceite-de-oliva", 5]] },
  { titulo: "Salmón a la plancha con verdura", tomas: ["comida", "cena"], clave: "salmon", items: [["salmon-a-la-plancha", 150], ["verdura-variada", 200]] },
  { titulo: "Yogur de proteínas con una fruta", tomas: ["cena", "merienda"], clave: "yogur-de-proteinas", items: [["yogur-de-proteinas", 160], ["pieza-de-fruta", 150]] },
  { titulo: "Tortilla de verduras con un poco de pan integral", tomas: ["cena"], clave: "huevo", items: [["tortilla-de-verduras", 150], ["pan-integral", 30], ["tomate", 100]] },
];

export type Opcion = { titulo: string; items: { foodId: string; g: number }[]; porque: string; cifra: string; kcal: number; p: number };

export function totalesPlato(items: { foodId: string; g: number }[], cat?: Catalogo): Por100 {
  const t: Por100 = { kcal: 0, p: 0, c: 0, az: 0, fi: 0, gr: 0 };
  for (const it of items) {
    const f = getFood(it.foodId, cat);
    if (!f) continue;
    const k = it.g / 100;
    t.kcal += f.kcal * k; t.p += f.p * k; t.c += f.c * k; t.az += f.az * k; t.fi += f.fi * k; t.gr += f.gr * k;
  }
  return t;
}

export function queComer(ctx: { perfil: Perfil; dia: Meal[]; toma: Toma; frecuentes: string[]; catalogo?: Catalogo; excluir?: string[] }): { opciones: Opcion[]; mensaje?: string } {
  const { perfil, dia, toma } = ctx;
  const tot = totalesDia(dia);
  const rem = { kcal: perfil.kcal - tot.kcal, p: perfil.prot - tot.p, c: perfil.hcMax - tot.c };
  if (rem.kcal < 120) {
    return { opciones: [], mensaje: "Ya has cubierto el día. Si te entra hambre: una infusión, un yogur natural o una fruta." };
  }
  const hechas = new Set(dia.map((m) => m.toma));
  const pendientes = TOMAS_DIA.filter((t) => !hechas.has(t) || t === toma);
  const sumaFrac = pendientes.reduce((s, t) => s + REPARTO[t].frac, 0) || 1;
  const share = Math.min(1, REPARTO[toma].frac / sumaFrac);
  const objK = Math.max(150, rem.kcal * share);
  const objP = Math.max(10, Math.min(45, rem.p * share));
  const hcMax = Math.max(15, Math.min(perfil.hcComida, rem.c > 0 ? rem.c : perfil.hcComida));
  const frec = new Set(ctx.frecuentes);
  const hoy = new Set(dia.flatMap((m) => m.items.map((i) => i.foodId)));
  const cat = ctx.catalogo;

  const puntuados = PLATOS.filter((pl) => pl.tomas.includes(toma) && !(ctx.excluir ?? []).includes(pl.titulo)).map((pl) => {
    const items = pl.items.map(([foodId, g]) => ({ foodId, g }));
    const t = totalesPlato(items, cat);
    let s = 0;
    const dk = (t.kcal - objK) / objK;
    s -= dk > 0 ? dk * 1.6 : -dk * 1.0;
    s += Math.min(t.p, objP) / objP * 1.6;
    if (t.c > hcMax) s -= (t.c - hcMax) / 20;
    const usados = items.filter((i) => frec.has(i.foodId)).length;
    s += Math.min(1, usados * 0.3);
    if (items.some((i) => hoy.has(i.foodId) && !["aceite-de-oliva", "tomate", "ensalada-mixta", "pan-integral"].includes(i.foodId))) s -= 0.3;
    return { pl, items, t, s, usados };
  });
  puntuados.sort((a, b) => b.s - a.s);
  const elegidos: typeof puntuados = [];
  for (const x of puntuados) {
    if (elegidos.some((e) => e.pl.clave === x.pl.clave)) continue;
    elegidos.push(x);
    if (elegidos.length === 3) break;
  }
  const opciones: Opcion[] = elegidos.map(({ pl, items, t, usados }) => {
    let porque: string;
    if (t.p >= 22 && rem.p > 30) porque = "Así llegas a la proteína que necesitas para el músculo y te quedas saciado.";
    else if (usados >= 2) porque = "Lleva cosas que ya sueles comer y te ayuda con la proteína.";
    else if (t.kcal < objK * 0.75) porque = "Es ligera y te deja margen para el resto del día.";
    else if (t.c < 25) porque = "Lleva pocos hidratos, así el azúcar te sube menos.";
    else porque = "Es sencilla y te da proteína sin pasarte de calorías.";
    return { titulo: pl.titulo, items, porque, cifra: `≈ ${ktxt(t.kcal)} · ${u(t.p, "g")} de proteína`, kcal: t.kcal, p: t.p };
  });
  return { opciones };
}

/* ------------------------------------------------------------------ */
/* Historial: lo que Jorge suele comer                                 */
/* ------------------------------------------------------------------ */
export type Frecuente = { clave: string; foodId: string | null; nombre: string; veces: number; g: number };
export function topFrecuentes(meals: Meal[], n = 30): Frecuente[] {
  const map = new Map<string, Frecuente & { suma: number }>();
  for (const m of meals) {
    for (const it of m.items) {
      const clave = it.foodId ?? `n:${it.nombre.toLowerCase()}`;
      const prev = map.get(clave);
      if (prev) { prev.veces++; prev.suma += it.g; }
      else map.set(clave, { clave, foodId: it.foodId, nombre: it.nombre, veces: 1, suma: it.g, g: it.g });
    }
  }
  return [...map.values()].map((x) => ({ clave: x.clave, foodId: x.foodId, nombre: x.nombre, veces: x.veces, g: Math.round(x.suma / x.veces) })).sort((a, b) => b.veces - a.veces).slice(0, n);
}

/* ------------------------------------------------------------------ */
/* Resumen del día                                                     */
/* ------------------------------------------------------------------ */
export function revisionDia(meals: Meal[], perfil: Perfil): Correccion[] {
  const out: Correccion[] = [];
  if (!meals.length) return out;
  const t = totalesDia(meals);
  const push = (c: Omit<Correccion, "origen">) => out.push({ ...c, origen: "reglas" });
  if (t.p >= perfil.protMin) push({ tipo: "ok", texto: "Proteína del día cubierta", porque: "Eso cuida tu músculo mientras pierdes grasa.", cifra: `${u(t.p, "g")} de ${u(perfil.prot, "g")}` });
  else push({ tipo: t.p < perfil.protMin * 0.7 ? "alerta" : "aviso", texto: `Te ha faltado proteína: añade mañana un yogur de proteínas o un par de huevos`, porque: "Así cuidas el músculo y te quedas saciado.", cifra: `${u(t.p, "g")} de ${u(perfil.prot, "g")}` });
  if (t.kcal > perfil.kcalMax + 150) push({ tipo: "aviso", texto: "Te has pasado un poco de calorías", porque: "Mañana, platos más ligeros y sin picoteo.", cifra: `${ktxt(t.kcal)} de ${ktxt(perfil.kcal)}` });
  else if (t.kcal < perfil.kcalMin - 350 && meals.length >= 3) push({ tipo: "aviso", texto: "Has comido poco: no te quedes corto", porque: "Si te quedas muy corto, pierdes músculo y al día siguiente tienes más hambre.", cifra: `${ktxt(t.kcal)} de ${ktxt(perfil.kcal)}` });
  else if (t.kcal >= perfil.kcalMin - 150) push({ tipo: "ok", texto: "Calorías del día bien", cifra: `${ktxt(t.kcal)} de ${ktxt(perfil.kcal)}` });
  if (t.fi < perfil.fibra * 0.6 && meals.length >= 3) push({ tipo: "aviso", texto: "Te ha faltado fibra: más verdura, legumbre o fruta entera", porque: "Te sacia y el azúcar te sube menos.", cifra: `${u(t.fi, "g")} de ${u(perfil.fibra, "g")}` });
  if (t.c > perfil.hcMax + 20) push({ tipo: "aviso", texto: "Muchos hidratos hoy (pan, arroz, pasta, patata, fruta…)", porque: "Con algo menos de eso el azúcar te sube menos.", cifra: `${u(t.c, "g")} de ${u(perfil.hcMax, "g")} como máximo` });
  return out.sort((a, b) => ordenTipo[a.tipo] - ordenTipo[b.tipo]);
}

/* ------------------------------------------------------------------ */
/* Semana                                                              */
/* ------------------------------------------------------------------ */
export type DiaSemana = { fecha: string; meals: Meal[]; tot: Por100; tiene: boolean; enObjetivo: boolean };
export type Error = { texto: string; porque: string; cuenta: number; de: number; propuesta: string };
export type Semana = {
  dias: DiaSemana[];
  conDatos: number;
  enObjetivo: number;
  medias: Por100;
  errores: Error[];
  bien: string[];
  propuestas: string[];
  glucosa: string[];
};

export function revisionSemana(inicio: string, meals: Meal[], perfil: Perfil): Semana {
  const dias: DiaSemana[] = [];
  for (let i = 0; i < 7; i++) {
    const fecha = addDays(inicio, i);
    const ms = meals.filter((m) => m.fecha === fecha);
    const tot = totalesDia(ms);
    const tiene = ms.length > 0;
    dias.push({ fecha, meals: ms, tot, tiene, enObjetivo: tiene && tot.kcal >= perfil.kcal * 0.9 && tot.kcal <= perfil.kcal * 1.1 && tot.p >= perfil.protMin });
  }
  const con = dias.filter((d) => d.tiene);
  const n = con.length || 1;
  const medias: Por100 = { kcal: 0, p: 0, c: 0, az: 0, fi: 0, gr: 0 };
  for (const d of con) { medias.kcal += d.tot.kcal / n; medias.p += d.tot.p / n; medias.c += d.tot.c / n; medias.fi += d.tot.fi / n; medias.gr += d.tot.gr / n; medias.az += d.tot.az / n; }

  const errores: Error[] = [];
  const bien: string[] = [];
  const all = dias.flatMap((d) => d.meals);
  const porToma = (t: Toma) => all.filter((m) => m.toma === t);
  const sumM = (m: Meal) => sumar(m.items);

  const desayunos = porToma("desayuno");
  const flojos = desayunos.filter((m) => sumM(m).p < 20);
  if (desayunos.length >= 2 && flojos.length >= Math.max(2, Math.ceil(desayunos.length / 2))) {
    errores.push({ texto: `Desayunos flojos de proteína: ${flojos.length} de ${desayunos.length} por debajo de 20 g`, porque: "Con poca proteína por la mañana tienes hambre antes y el músculo lo nota.", cuenta: flojos.length, de: desayunos.length, propuesta: "En el desayuno, añade un yogur de proteínas o dos huevos." });
  } else if (desayunos.length >= 2 && flojos.length === 0) bien.push("Desayunos con buena proteína.");

  const cenas = porToma("cena");
  const cenasHc = cenas.filter((m) => sumM(m).c > perfil.hcComida);
  if (cenas.length >= 2 && cenasHc.length >= 2) {
    errores.push({ texto: `${cenasHc.length} de ${cenas.length} cenas con demasiados hidratos (más de ${u(perfil.hcComida, "g")})`, porque: "De noche el azúcar tarda más en bajar.", cuenta: cenasHc.length, de: cenas.length, propuesta: "En la cena, pon la mitad de pan, arroz o pasta y más verdura o proteína." });
  } else if (cenas.length >= 3 && cenasHc.length === 0) bien.push("Cenas con los hidratos bien medidos.");

  const comidas = porToma("comida");
  const comidasHc = comidas.filter((m) => sumM(m).c > perfil.hcComida);
  if (comidas.length >= 2 && comidasHc.length >= 2) {
    errores.push({ texto: `${comidasHc.length} de ${comidas.length} comidas con demasiados hidratos`, porque: "Después de comer el azúcar te sube más de la cuenta.", cuenta: comidasHc.length, de: comidas.length, propuesta: "En la comida, mitad de arroz, pasta o pan y la verdura primero." });
  }

  const finde = con.filter((d) => dowIndex(d.fecha) >= 5);
  const sem = con.filter((d) => dowIndex(d.fecha) < 5);
  if (finde.length && sem.length >= 2) {
    const mf = finde.reduce((s, d) => s + d.tot.kcal, 0) / finde.length;
    const ms = sem.reduce((s, d) => s + d.tot.kcal, 0) / sem.length;
    if (mf - ms >= 400) errores.push({ texto: `Fines de semana con +${ktxt(mf - ms)} al día`, porque: "Se come más fuera de casa y se picotea.", cuenta: finde.length, de: finde.length, propuesta: "El fin de semana, mismo desayuno y una sola caña o copa." });
  }

  if (con.length >= 3 && medias.fi < perfil.fibra * 0.75) {
    errores.push({ texto: `Poca fibra: ${u(medias.fi, "g")} de media`, porque: "La fibra te sacia y hace que el azúcar suba más despacio.", cuenta: con.length, de: con.length, propuesta: "Añade legumbre de bote, verdura o fruta entera todos los días." });
  } else if (con.length >= 3 && medias.fi >= perfil.fibra * 0.95) bien.push("Fibra en su sitio.");

  if (con.length >= 3 && medias.p < perfil.protMin) {
    errores.push({ texto: `Proteína corta: ${u(medias.p, "g")} de media`, porque: "Con poca proteína cuesta ganar músculo.", cuenta: con.length, de: con.length, propuesta: "Mete una fuente de proteína en cada toma: huevos, atún, pollo, yogur de proteínas." });
  } else if (con.length >= 3 && medias.p >= perfil.protMin) bien.push(`Proteína cubierta (${u(medias.p, "g")} de media).`);

  const bebidas = all.filter((m) => m.items.some((i) => (i.cat === "bebida" && itemTotales(i).az >= 10) || i.foodId === "zumo-de-naranja"));
  if (bebidas.length >= 2) errores.push({ texto: `Refrescos o zumos en ${bebidas.length} comidas`, porque: "Te suben mucho el azúcar y no sacian.", cuenta: bebidas.length, de: all.length, propuesta: "Cambia el refresco o el zumo por agua con gas y la fruta entera." });

  const sinVerdura = [...comidas, ...cenas].filter((m) => m.items.reduce((s, i) => s + (i.cat === "verdura" || i.cat === "legumbre" ? i.g : 0), 0) < 80);
  const totalPrincipales = comidas.length + cenas.length;
  if (totalPrincipales >= 4 && sinVerdura.length >= Math.ceil(totalPrincipales / 2)) {
    errores.push({ texto: `${sinVerdura.length} de ${totalPrincipales} comidas y cenas sin verdura`, porque: "La verdura te sacia con pocas calorías.", cuenta: sinVerdura.length, de: totalPrincipales, propuesta: "Mete una ensalada o verdura congelada en comidas y cenas." });
  }

  const bollos = all.filter((m) => m.items.some((i) => i.cat === "bolleria" || (i.cat === "snack" && itemTotales(i).kcal > 150)));
  if (bollos.length >= 2) errores.push({ texto: `Bollería o bolsas de snacks en ${bollos.length} ocasiones`, porque: "Calorías fáciles que no sacian.", cuenta: bollos.length, de: all.length, propuesta: "Cámbialo por una pieza de fruta, un yogur o un puñado de frutos secos." });

  if (con.length >= 3 && medias.kcal > perfil.kcalMax * 1.1) errores.push({ texto: `Calorías por encima del objetivo: ${ktxt(medias.kcal)} de media`, porque: "Para perder grasa hay que quedarse un poco por debajo.", cuenta: con.length, de: con.length, propuesta: "Quita el picoteo y reduce a la mitad lo más harinoso de las comidas." });
  if (con.length >= 3 && medias.kcal < perfil.kcalMin * 0.8) errores.push({ texto: `Te quedas corto de calorías: ${ktxt(medias.kcal)} de media`, porque: "Si comes muy poco pierdes músculo y luego picas.", cuenta: con.length, de: con.length, propuesta: "No te saltes ninguna toma y añade una merienda con proteína." });
  else if (con.length >= 3 && medias.kcal >= perfil.kcalMin * 0.95 && medias.kcal <= perfil.kcalMax * 1.05) bien.push("Calorías en su sitio.");

  const enObj = dias.filter((d) => d.enObjetivo).length;
  if (enObj >= 3) bien.push(`${enObj} días dentro de objetivo.`);

  // Glucosa y comidas
  const glucosa: string[] = [];
  const conGluc = all.filter((m) => m.glucDespues != null);
  if (conGluc.length >= 2) {
    const altas = conGluc.filter((m) => (m.glucDespues ?? 0) >= 160);
    if (altas.length) {
      const cuenta = new Map<string, number>();
      for (const m of altas) for (const i of m.items) if (i.por100.c >= 10 && i.g >= 40) cuenta.set(i.nombre, (cuenta.get(i.nombre) ?? 0) + 1);
      const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n.toLowerCase());
      glucosa.push(`${altas.length} de ${conGluc.length} medidas a las 2 h salieron altas (160 o más).${top.length ? ` Se repiten: ${top.join(", ")}.` : ""}`);
    } else glucosa.push(`Las ${conGluc.length} medidas a las 2 h de comer salieron bien (por debajo de 160).`);
    const grandes = conGluc.filter((m) => sumM(m).c > 60 && m.glucAntes != null);
    const peques = conGluc.filter((m) => sumM(m).c <= 45 && m.glucAntes != null);
    const subida = (ms: Meal[]) => ms.reduce((s, m) => s + ((m.glucDespues ?? 0) - (m.glucAntes ?? 0)), 0) / Math.max(1, ms.length);
    if (grandes.length && peques.length) glucosa.push(`Con más de 60 g de hidratos te subió ${fmt(subida(grandes))} mg/dL de media; con menos de 45 g, ${fmt(subida(peques))}.`);
  }

  // Propuestas: las 3 más importantes
  const propuestas = errores.slice(0, 3).map((e) => e.propuesta);
  const extras = ["Camina 10-15 minutos después de la comida principal.", "Apunta lo que comes en el momento: es más fácil y más exacto.", "Prepara de antemano la verdura y la proteína para tener algo sano a mano."];
  for (const x of extras) if (propuestas.length < 3) propuestas.push(x);

  return { dias, conDatos: con.length, enObjetivo: enObj, medias, errores, bien, propuestas, glucosa };
}

/* ------------------------------------------------------------------ */
/* Texto de un día / semana para compartir o para la IA                */
/* ------------------------------------------------------------------ */
export function itemLinea(i: Item): string {
  const t = itemTotales(i);
  return `${i.nombre} ${gtxt(i.g)} (${fmt(t.kcal)} kcal, ${fmt(t.p)} g prot, ${fmt(t.c)} g hidr)`;
}
export { tomaLabel };
