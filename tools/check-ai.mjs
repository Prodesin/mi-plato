// Pruebas de la capa de IA con fetch simulado: formato de cada proveedor, validación del esquema y prompt de sistema.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function load(entry) {
  const r = await build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
}
globalThis.window = globalThis;
const ai = await load("src/ai.ts");
const { FOODS } = await load("src/foods.ts");
const { PERFIL_JORGE } = await load("src/types.ts");
let bad = 0;
const fail = (m) => { bad++; console.log("✗ " + m); };

const OK = { items: [{ nombre: "Tortilla de patatas", gramos: 150, kcal: 260, proteina: 9, hidratos: 16, azucares: 1, fibra: 2, grasa: 17, ig: "alto", confianza: "media" }], correcciones: [{ tipo: "aviso", texto: "Añade una ensalada" }], resumen: "Vale." };
// validación
try { const r = ai.validarRespuesta("```json\n" + JSON.stringify(OK) + "\n```"); if (r.items.length !== 1) fail("validación: items"); } catch (e) { fail("JSON válido rechazado: " + e.message); }
for (const [n, mal] of [["sin items", { ...OK, items: undefined }], ["ig inválido", { ...OK, items: [{ ...OK.items[0], ig: "x" }] }], ["gramos 0", { ...OK, items: [{ ...OK.items[0], gramos: 0 }] }], ["texto no JSON", "hola"], ["tipo corr inválido", { ...OK, correcciones: [{ tipo: "zzz", texto: "a" }] }]]) {
  try { ai.validarRespuesta(typeof mal === "string" ? mal : JSON.stringify(mal)); fail("debería rechazar: " + n); } catch (e) { if (!(e instanceof ai.ErrorIA)) fail("error inesperado en " + n); }
}
// cruce con la base: desviación grande → aviso
const raro = ai.itemsDeIA(ai.validarRespuesta(JSON.stringify({ ...OK, items: [{ ...OK.items[0], kcal: 900 }] })), FOODS);
if (!raro[0].aviso) fail("debe avisar si la IA se desvía mucho de la base");
const normal = ai.itemsDeIA(ai.validarRespuesta(JSON.stringify(OK)), FOODS);
if (normal[0].aviso) fail("no debe avisar si la IA coincide con la base");
// Fibra: la IA no debe colar un 0 engañoso
{
  const base = { ...OK.items[0], hidratos: 40, azucares: 2, gramos: 300 };
  for (const fibra of [0, null, undefined]) {
    const it = { ...base, fibra }; if (fibra === undefined) delete it.fibra;
    const r = ai.validarRespuesta(JSON.stringify({ ...OK, items: [it] }));
    if (!(r.items[0].fibra > 0) || !r.items[0].fibraEst) fail("fibra " + fibra + " con 40 g de hidratos debe estimarse (>0) y marcarse");
  }
  const real = ai.validarRespuesta(JSON.stringify({ ...OK, items: [{ ...base, fibra: 5 }] }));
  if (real.items[0].fibra !== 5 || real.items[0].fibraEst) fail("una fibra dada por la IA no se toca");
  const carne = ai.validarRespuesta(JSON.stringify({ ...OK, items: [{ ...OK.items[0], hidratos: 0, azucares: 0, fibra: 0 }] }));
  if (carne.items[0].fibra !== 0 || carne.items[0].fibraEst) fail("0 de fibra con 0 hidratos es correcto");
}
// prompt
const hist = [{ id: "1", fecha: "2026-11-25", hora: "14:00", toma: "comida", texto: "", items: [{ id: "a", foodId: "huevo", nombre: "Huevo", g: 120, por100: { kcal: 143, p: 12.6, c: .7, az: .4, fi: 0, gr: 9.8 }, ig: "bajo", cat: "huevo", fuente: "base" }] }];
const sys = ai.promptSistema({ perfil: PERFIL_JORGE, hoy: hist, historial: hist, toma: "cena", hora: "21:00" });
for (const frag of ["NO impone menús, planes ni dietas", "Mejor media barra que una entera", "así el azúcar te sube menos", "huevo", "1.850".replace(".", ""), "NO propongas menús, planes ni ingredientes raros", "{\"items\""]) if (!sys.includes(frag)) fail("el prompt no incluye: " + frag);
// proveedores (fetch simulado)
const calls = [];
globalThis.fetch = async (url, init) => { calls.push({ url, init }); const u = String(url);
  const body = u.includes("anthropic") ? { content: [{ type: "text", text: JSON.stringify(OK) }] } : u.includes("googleapis") ? { candidates: [{ content: { parts: [{ text: JSON.stringify(OK) }] } }] } : { choices: [{ message: { content: JSON.stringify(OK) } }] };
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }; };
const img = "data:image/jpeg;base64,QUJD";
for (const prov of ["anthropic", "gemini", "xai", "openai"]) {
  calls.length = 0;
  const r = await ai.analizarComida({ proveedor: prov, clave: "K", modelo: "" }, { perfil: PERFIL_JORGE, hoy: [], historial: [], toma: "comida", hora: "14:00" }, "una tortilla", [img]);
  const c = calls[0]; const h = c.init.headers; const b = JSON.parse(c.init.body);
  if (r.items.length !== 1) fail(prov + ": respuesta no interpretada");
  if (prov === "anthropic") { if (c.url !== "https://api.anthropic.com/v1/messages" || h["x-api-key"] !== "K" || h["anthropic-version"] !== "2023-06-01" || h["anthropic-dangerous-direct-browser-access"] !== "true") fail("anthropic: cabeceras/URL"); if (b.model !== "claude-haiku-5-5" || b.messages[0].content[0].source?.media_type !== "image/jpeg") fail("anthropic: cuerpo"); }
  if (prov === "gemini") { if (!c.url.includes("gemini-3.5-flash-lite:generateContent") || h["x-goog-api-key"] !== "K" || h.Authorization) fail("gemini: cabeceras/URL"); if (b.generationConfig.responseMimeType !== "application/json" || !b.contents[0].parts[0].inline_data) fail("gemini: cuerpo"); }
  if (prov === "xai") { if (c.url !== "https://api.x.ai/v1/chat/completions" || h.Authorization !== "Bearer K" || b.model !== "grok-4.3" || b.response_format.type !== "json_object" || !b.messages[1].content[1].image_url.url.startsWith("data:image/jpeg")) fail("xai: petición"); }
  if (prov === "openai") { if (c.url !== "https://api.openai.com/v1/chat/completions" || h.Authorization !== "Bearer K" || b.model !== "gpt-5-mini" || b.response_format.type !== "json_object") fail("openai: petición"); }
}
// errores amables
globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
try { await ai.llamarIA({ proveedor: "openai", clave: "K", modelo: "" }, "s", "u"); fail("debía fallar"); } catch (e) { if (!/No se pudo conectar: revisa la clave/.test(e.message)) fail("mensaje de error poco amable: " + e.message); }
globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "{}" });
try { await ai.llamarIA({ proveedor: "xai", clave: "K", modelo: "" }, "s", "u"); } catch (e) { if (!/clave/.test(e.message)) fail("401 sin mensaje de clave"); }
// mensajes por código HTTP
for (const [st, body, rx, prov] of [[400, '{"error":{"message":"API key not valid. Please pass a valid API key."}}', /clave de Gemini no es válida/, "gemini"], [429, "{}", /Sin cuota/, "gemini"], [503, "{}", /saturado: inténtalo en un momento/, "gemini"], [403, "{}", /clave/, "gemini"]]) {
  globalThis.fetch = async () => ({ ok: false, status: st, text: async () => body });
  try { await ai.llamarIA({ proveedor: prov, clave: "K", modelo: "" }, "s", "u"); fail("debía fallar " + st); } catch (e) { if (!rx.test(e.message)) fail(`HTTP ${st}: mensaje «${e.message}»`); }
}
// ración casera de la IA: «2 huevos» → rac huevo de 60 g
{
  const r = ai.validarRespuesta(JSON.stringify({ ...OK, items: [{ ...OK.items[0], nombre: "Cosa rara", gramos: 120, racion: "un huevo", raciones: 2 }] }));
  if (r.items[0].rac?.sing !== "huevo" || r.items[0].rac?.g !== 60) fail("ración casera de la IA mal interpretada: " + JSON.stringify(r.items[0].rac));
  const it = ai.itemsDeIA(r, FOODS);
  if (it[0].foodId == null && it[0].rac?.g !== 60) fail("el item de IA debe conservar su ración casera");
}
if (ai.provInfo("gemini").defecto !== "gemini-3.5-flash-lite") fail("modelo por defecto de Gemini");
if (!ai.GEMINI_MODELOS.some((m) => m.id === "gemini-3.8-flash")) fail("falta gemini-3.8-flash");
// orden y etiquetas de proveedores
const ids = ai.PROVEEDORES.map((p) => p.id).join(",");
if (ids !== "anthropic,gemini,xai,openai") fail("orden de proveedores: " + ids);
if (!ai.PROVEEDORES[0].nombre.includes("recomendado") || !ai.PROVEEDORES[1].nombre.includes("nivel gratuito")) fail("etiquetas de proveedores");
console.log(bad ? `\n${bad} problema(s)` : "OK ai");
process.exit(bad ? 1 : 0);
