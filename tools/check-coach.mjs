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
// Qué comer ahora
const q = coach.queComer({ perfil: PERFIL_JORGE, dia: [], toma: "cena", frecuentes: ["huevo", "atun-al-natural"] });
console.log("\nQué cenar:"); for (const o of q.opciones) console.log(`  - ${o.titulo} — ${o.porque} (${o.cifra})`);
if (q.opciones.length < 2) fail("qué comer ahora debe dar 2-3 opciones");
console.log(bad ? `\n${bad} problema(s)` : "\nOK coach");
process.exit(bad ? 1 : 0);
