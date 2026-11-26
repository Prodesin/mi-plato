// Pruebas del parser de texto libre: frases reales → alimentos y gramos esperados.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function load(entry) {
  const r = await build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
}
const { FOODS } = await load("src/foods.ts");
const { parseMeal, buscar } = await load("src/parser.ts");

// [frase, [[id esperado, gramos mínimos, gramos máximos], ...]]
const CASOS = [
  ["dos huevos, una tostada de pan integral y café con leche", [["huevo", 120, 120], ["pan-integral", 35, 35], ["cafe-con-leche", 200, 200]]],
  ["un plato de lentejas", [["lentejas-cocidas", 300, 300]]],
  ["media ración de arroz con pollo", [["arroz-con-pollo", 140, 160]]],
  ["ensalada con atún y un chorrito de aceite", [["ensalada-mixta", 200, 200], ["atun-al-natural", 52, 52], ["aceite-de-oliva", 5, 5]]],
  ["una cerveza y unas bravas", [["cerveza", 200, 200], ["patatas-bravas", 200, 200]]],
  ["200 g de pechuga de pollo a la plancha", [["pechuga-de-pollo-a-la-plancha", 200, 200]]],
  ["un yogur natural", [["yogur-natural", 125, 125]]],
  ["3 galletas María", [["galletas-maria", 18, 18]]],
  ["una lata de atún", [["atun-al-natural", 52, 52]]],
  ["tortilla de patatas con ensalada", [["tortilla-de-patatas", 150, 150], ["ensalada-mixta", 200, 200]]],
  ["unos 150 g de arroz", [["arroz-blanco-cocido", 150, 150]]],
  ["100 gr de queso fresco batido", [["queso-fresco-batido-0", 100, 100]]],
  ["plato grande de macarrones", [["pasta-cocida", 280, 300]]],
  ["ración pequeña de paella", [["paella", 200, 220]]],
  ["media barra de pan", [["pan-blanco", 125, 125]]],
  ["un par de huevos fritos", [["huevo-frito", 110, 110]]],
  ["un vaso de leche con colacao", [["leche-semidesnatada", 200, 200], ["cola-cao", 15, 15]]],
  ["una manzana, un plátano y 30 g de nueces", [["manzana", 180, 180], ["platano", 120, 120], ["nueces", 30, 30]]],
  ["bocadillo de jamón serrano", [["bocadillo-de-jamon", 200, 200]]],
  ["dos rebanadas de pan con tomate y aceite", [["pan-blanco", 60, 60], ["tomate", 100, 200], ["aceite-de-oliva", 10, 10]]],
  ["merluza a la plancha con verdura", [["merluza-a-la-plancha", 150, 150], ["verdura-variada", 250, 250]]],
  ["1,5 vasos de zumo de naranja", [["zumo-de-naranja", 300, 300]]],
  ["cuatro croquetas", [["croquetas", 120, 120]]],
  ["pulpo á feira", [["pulpo-a-feira", 200, 200]]],
  ["yogur de proteínas con un puñado de nueces", [["yogur-de-proteinas", 160, 160], ["nueces", 25, 25]]],
  ["café solo sin azúcar", [["cafe-solo", 50, 50]]],
  ["una pizza", [["pizza", 350, 350]]],
  ["2 tostadas con jamón york y queso", [["pan-blanco", 70, 70], ["jamon-cocido", 20, 20], ["queso-semicurado", 30, 30]]],
  ["una copa de vino", [["vino", 150, 150]]],
  ["Lentejas, pollo; fruta\ny un yogur", [["lentejas-cocidas", 300, 300], ["pechuga-de-pollo-a-la-plancha", 150, 150], ["pieza-de-fruta", 150, 150], ["yogur-natural", 125, 125]]],
  ["un cuarto de pollo asado", [["pollo-asado", 150, 150]]],
  ["dos latas de atún en aceite", [["atun-en-aceite", 104, 104]]],
  ["una y media de pan integral", [["pan-integral", 45, 45]]],
  ["una cervesa", [["cerveza", 200, 200]]],
  ["tres cucharadas de hummus", [["hummus", 45, 90]]],
];

let bad = 0;
for (const [frase, esperado] of CASOS) {
  const res = parseMeal(frase, FOODS);
  const obtenido = res.map((r) => `${r.food?.id ?? "?"}:${r.g}`).join(", ");
  let ok = res.length === esperado.length;
  if (ok) esperado.forEach(([id, lo, hi], i) => { const r = res[i]; if (!r.food || r.food.id !== id || r.g < lo || r.g > hi) ok = false; });
  if (!ok) { bad++; console.log(`✗ «${frase}»\n    esperado: ${esperado.map((e) => `${e[0]}:${e[1]}${e[1] !== e[2] ? "-" + e[2] : ""}`).join(", ")}\n    obtenido: ${obtenido}`); }
}
// Lo desconocido debe quedar marcado, no inventado
const raro = parseMeal("dos platos de zzxqv", FOODS);
if (!(raro.length === 1 && raro[0].food === null)) { bad++; console.log("✗ lo desconocido debe quedar sin alimento", raro); }
// Buscador
for (const [q, id] of [["lent", "lentejas-cocidas"], ["atun", "atun-al-natural"], ["colacao", "cola-cao"]]) {
  const r = buscar(q, FOODS, 8).map((f) => f.id);
  if (!r.includes(id)) { bad++; console.log(`✗ buscar("${q}") no devuelve ${id}: ${r.join(", ")}`); }
}
console.log(bad ? `\n${bad} caso(s) con error de ${CASOS.length + 4}` : `OK: ${CASOS.length} frases + desconocido + buscador`);
process.exit(bad ? 1 : 0);
