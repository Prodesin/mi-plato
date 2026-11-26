// Pruebas del motor de reglas: las correcciones deben ser concretas, en lenguaje llano y sin jerga.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function load(entry) {
  const r = await build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
}
const { FOODS } = await load("src/foods.ts");
const { parseMeal } = await load("src/parser.ts");
const coach = await load("src/coach.ts");
const { PERFIL_JORGE } = await load("src/types.ts");
const mk = (txt) => parseMeal(txt, FOODS).map((p, i) => ({ id: "i" + i, foodId: p.food?.id ?? null, nombre: p.food?.n ?? p.texto, g: p.g, por100: { kcal: p.food.kcal, p: p.food.p, c: p.food.c, az: p.food.az, fi: p.food.fi, gr: p.food.gr }, ig: p.food.ig, cat: p.food.cat, fuente: "base" }));
const JERGA = /índice glucémico|macronutriente|hidratos netos|densidad calórica|\bIG\b|glucémic/i;
let bad = 0;
const fail = (m) => { bad++; console.log("✗ " + m); };
const run = (txt, toma, hora) => coach.corregirComida({ items: mk(txt), toma, hora }, { perfil: PERFIL_JORGE, dia: [] });
const show = (t, r) => { console.log(`\n«${t}»`); for (const c of r) console.log(`  [${c.tipo}] ${c.texto}${c.porque ? " — " + c.porque : ""}${c.cifra ? "  (" + c.cifra + ")" : ""}`); };

const casos = [
  ["dos huevos, una tostada de pan integral y café con leche", "desayuno", "08:30"],
  ["una cerveza y unas bravas y croquetas", "cena", "21:45"],
  ["un plato grande de macarrones con tomate y un refresco", "comida", "14:30"],
  ["un cruasán y zumo de naranja", "desayuno", "09:00"],
  ["tortilla de patatas con ensalada y pan", "cena", "21:00"],
  ["200 g de pechuga de pollo a la plancha, ensalada con atún y aceite", "comida", "14:00"],
];
for (const [t, toma, h] of casos) {
  const r = run(t, toma, h);
  show(t, r);
  if (!r.length) fail(`sin correcciones para «${t}»`);
  if (r.length > 4) fail("más de 4 correcciones");
  for (const c of r) {
    if (JERGA.test(c.texto + (c.porque || "") + (c.cifra || ""))) fail("jerga en: " + c.texto);
    if (c.tipo !== "ok" && !c.porque) fail("sin porqué: " + c.texto);
  }
}
// Protein baja → debe proponer añadir algo concreto con cantidad
const r1 = run("una tostada de pan integral y café con leche", "desayuno", "08:00");
if (!r1.some((c) => c.accion?.t === "anadir" && /proteína/i.test(c.porque + c.cifra))) fail("falta propuesta de proteína concreta");
// Muchos hidratos → reducir racion
const r2 = run("un plato grande de macarrones con tomate", "comida", "14:00");
if (!r2.some((c) => c.accion?.t === "gramos" && /vas bien/.test(c.texto))) fail("falta reducir la ración de hidratos");
const r3 = run("un refresco", "merienda", "17:00");
if (!r3.some((c) => /agua/.test(c.texto))) fail("el refresco debe cambiarse por agua");
// Comida buena → mensaje positivo
const r4 = run("200 g de pechuga de pollo a la plancha, ensalada mixta, 40 g de pan integral y aceite", "comida", "14:00");
if (!r4.some((c) => c.tipo === "ok")) fail("una comida buena debe tener mensaje positivo");
// Sugerencias caseras: nada de gambas ni de dos latas; medidas de casa (sin «15 g de pan»)
const r5 = run("un plato de lentejas, 60 g de pan blanco y una manzana", "comida", "14:00");
show("un plato de lentejas, 60 g de pan blanco y una manzana", r5);
for (const rr of [r1, r2, r3, r4, r5, ...casos.map(([t, toma, h]) => run(t, toma, h))]) for (const c of rr) {
  if (/gambas|dos latas|tres latas/i.test(c.texto)) fail("sugerencia poco casera: " + c.texto);
  if (/\b\d+ g de /.test(c.texto)) fail("gramos en el texto principal (van en la cifra): " + c.texto);
}

// ---- Retoques 2 ----
// Dato: «patatas panaderas mercadona 300 g» → ~50-60 g de hidratos y algo de fibra (no 119 g ni 0 g)
{
  const it = mk("patatas panaderas mercadona 300 g");
  const tot = it.reduce((a, i) => ({ c: a.c + i.por100.c * i.g / 100, fi: a.fi + i.por100.fi * i.g / 100 }), { c: 0, fi: 0 });
  console.log(`\npatatas panaderas 300 g → ${tot.c.toFixed(0)} g hidratos, ${tot.fi.toFixed(1)} g fibra (${it.map((i) => i.nombre + " " + i.g)})`);
  if (it.length !== 1 || it[0].g !== 300) fail("patatas panaderas: debe ser un alimento de 300 g");
  if (tot.c < 45 || tot.c > 65) fail("patatas panaderas: hidratos fuera de 45-65 g: " + tot.c);
  if (tot.fi < 3) fail("patatas panaderas: debe llevar algo de fibra");
}
// Ninguna sugerencia de proteína con legumbre (garbanzos, lentejas…)
for (const toma of ["desayuno", "comida", "merienda", "cena", "otro"]) {
  for (const txt of ["una tostada de pan integral", "una manzana", "ensalada de tomate", "un plato de arroz"]) {
    for (const frec of [[], ["garbanzos-cocidos", "lentejas-cocidas"]]) {
      const r = coach.corregirComida({ items: mk(txt), toma, hora: "13:00" }, { perfil: PERFIL_JORGE, dia: [], frecuentes: frec });
      for (const c of r) if (/garbanzo|lenteja|alubia/i.test(c.texto) && c.accion?.t === "anadir" && /proteína/i.test(c.porque + c.cifra)) fail("legumbre propuesta para la proteína: " + c.texto);
    }
  }
}
for (const toma of ["comida", "cena"]) for (const o of coach.queComer({ perfil: PERFIL_JORGE, dia: [], toma, frecuentes: ["garbanzos-cocidos"] }).opciones) if (/garbanzo/i.test(o.titulo)) fail("queComer propone garbanzos: " + o.titulo);
// Tomas: apuntes cercanos = una sola comida
{
  const mkMeal = (id, hora, toma, txt, fecha = "2026-11-25") => ({ id, fecha, hora, toma, texto: txt, items: mk(txt) });
  const g1 = coach.agruparTomas([mkMeal("a", "08:47", "desayuno", "un café con leche"), mkMeal("b", "11:09", "desayuno", "un café con leche")]);
  if (g1.length !== 1 || g1[0].apuntes.length !== 2) fail("dos cafés de desayuno (08:47 y 11:09) deben ser una sola toma");
  const g2 = coach.agruparTomas([mkMeal("c", "13:35", "comida", "patatas panaderas"), mkMeal("d", "13:44", "comida", "un yogur")]);
  if (g2.length !== 1) fail("patatas 13:35 + yogur 13:44 deben ser una sola comida");
  const g3 = coach.agruparTomas([mkMeal("e", "08:30", "desayuno", "un café con leche"), mkMeal("f", "14:00", "comida", "un plato de lentejas"), mkMeal("g", "21:00", "cena", "dos huevos")]);
  if (g3.length !== 3) fail("tomas distintas y lejanas deben seguir separadas");
  const g4 = coach.agruparTomas([mkMeal("h", "08:47", "desayuno", "un café con leche", "2026-11-24"), mkMeal("i", "08:50", "desayuno", "un café con leche", "2026-11-25")]);
  if (g4.length !== 2) fail("apuntes de días distintos no se juntan");
  // el consejo se da UNA vez para el conjunto
  const dosCafes = g1[0];
  const unico = coach.corregirComida(dosCafes, { perfil: PERFIL_JORGE, dia: [] }).filter((c) => c.accion?.t === "anadir" && /proteína/i.test(c.porque + c.cifra));
  const porApunte = [mkMeal("a", "08:47", "desayuno", "un café con leche"), mkMeal("b", "11:09", "desayuno", "un café con leche")].flatMap((m) => coach.corregirComida(m, { perfil: PERFIL_JORGE, dia: [] })).filter((c) => c.accion?.t === "anadir" && /proteína/i.test(c.porque + c.cifra));
  console.log(`\ndos cafés: ${unico.length} consejo(s) de proteína por toma frente a ${porApunte.length} por apunte`);
  if (unico.length !== 1) fail("la toma de dos cafés debe dar un único consejo de proteína");
  // revisión de semana: la toma cuenta una vez
  const sem = coach.revisionSemana("2026-11-23", [mkMeal("a", "08:47", "desayuno", "un café con leche", "2026-11-24"), mkMeal("b", "11:09", "desayuno", "un café con leche", "2026-11-24"), mkMeal("c", "08:30", "desayuno", "un café con leche", "2026-11-25")], PERFIL_JORGE);
  const err = sem.errores.find((e) => /Desayunos flojos/.test(e.texto));
  if (!err || err.de !== 2) fail("la semana debe contar 2 desayunos (no 3 apuntes): " + (err?.texto ?? "sin error"));
  // texto compartido: una sola entrada de toma
  const { construirPaquete } = await load("src/coco.ts");
  const pk = construirPaquete("2026-11-25", [mkMeal("a", "08:47", "desayuno", "un café con leche"), mkMeal("b", "11:09", "desayuno", "un café con leche")], PERFIL_JORGE);
  const n = (pk.texto.match(/Desayuno \(/g) || []).length;
  if (n !== 1) fail("el texto compartido debe tener una sola toma «Desayuno» (hay " + n + ")");
}
// Ración casera
{
  const { racionLabel, FOODS_BY_ID } = await load("src/foods.ts");
  const L = (id, n) => racionLabel(FOODS_BY_ID.get(id), n);
  console.log("\nraciones:", [L("cafe-con-leche", 2), L("lentejas-cocidas", 1), L("yogur-natural", 1), L("huevo", 2), L("lentejas-cocidas", 0.5)].join(" | "));
  if (L("cafe-con-leche", 2) !== "2 cafés con leche") fail("ración: «2 cafés con leche», sale «" + L("cafe-con-leche", 2) + "»");
  if (L("huevo", 2) !== "2 huevos") fail("ración: «2 huevos», sale «" + L("huevo", 2) + "»");
  if (!/^1 yogur/.test(L("yogur-natural", 1))) fail("ración: «1 yogur…»");
  if (!/^½ /.test(L("lentejas-cocidas", 0.5))) fail("ración: media ración con ½");
  if (!/^1 /.test(racionLabel(undefined, 1))) fail("ración sin conocer: «1 ración»");
}
// Qué comer ahora
const q = coach.queComer({ perfil: PERFIL_JORGE, dia: [], toma: "cena", frecuentes: ["huevo", "atun-al-natural"] });
console.log("\nQué cenar:"); for (const o of q.opciones) console.log(`  - ${o.titulo} — ${o.porque} (${o.cifra})`);
if (q.opciones.length < 2) fail("qué comer ahora debe dar 2-3 opciones");
console.log(bad ? `\n${bad} problema(s)` : "\nOK coach");
process.exit(bad ? 1 : 0);
