// Comprueba la base de alimentos: coherencia 4·P + 4·HC + 9·G (+7·alcohol) ≈ kcal (±15 % o ±6 kcal), ids únicos, raciones y referencias.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function load(entry) {
  const r = await build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
}
const { FOODS } = await load("src/foods.ts");
let bad = 0;
const fail = (m) => { bad++; console.log("✗ " + m); };
const ids = new Set();
for (const f of FOODS) {
  if (ids.has(f.id)) fail(`id repetido: ${f.id}`);
  ids.add(f.id);
  const est = 4 * f.p + 4 * f.c + 9 * f.gr + 7 * (f.alc || 0);
  const diff = Math.abs(est - f.kcal);
  if (diff > 6 && diff / Math.max(est, 1) > 0.15) fail(`${f.n}: kcal ${f.kcal} vs estimadas ${est.toFixed(0)}`);
  if (f.az > f.c + 0.01) fail(`${f.n}: azúcares (${f.az}) > hidratos (${f.c})`);
  if (f.fi > f.c + 0.01) fail(`${f.n}: fibra (${f.fi}) > hidratos (${f.c})`);
  if (!["bajo", "medio", "alto"].includes(f.ig)) fail(`${f.n}: ig inválido`);
  if (f.kcal < 0 || f.p + f.c + f.gr > 101) fail(`${f.n}: macros fuera de rango`);
  if (!f.rac.length) fail(`${f.n}: sin raciones`);
  for (const r of f.rac) if (!(r.g > 0)) fail(`${f.n}: ración inválida ${r.n}`);
}
if (FOODS.length < 300) fail(`solo ${FOODS.length} alimentos (mínimo 300)`);
// Referencias del entrenador (coach): todos los ids deben existir
const coach = await load("src/coach.ts").catch((e) => { fail("no se pudo cargar coach.ts: " + e.message); return null; });
if (coach?.COACH_IDS) for (const id of coach.COACH_IDS) if (!ids.has(id)) fail(`coach.ts usa un id que no existe: ${id}`);
console.log(bad ? `\n${bad} problema(s)` : `OK: ${FOODS.length} alimentos coherentes`);
process.exit(bad ? 1 : 0);
