/* Open Food Facts: productos por código de barras (EAN) y por nombre, con cámara (BarcodeDetector) o foto. */
import { parseRacion } from "./foods";
import type { Food, IG } from "./types";

const FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_size,quantity,product_quantity";

type OFFProducto = {
  code?: string; product_name?: string; product_name_es?: string; brands?: string; serving_quantity?: number | string; product_quantity?: number | string;
  nutriments?: Record<string, number | string>;
};

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? parseFloat(v.replace(",", ".")) : (v as number);
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};

export function alimentoDeOFF(p: OFFProducto): Food | null {
  const nu = p.nutriments ?? {};
  const kj = n(nu["energy-kj_100g"]) ?? n(nu["energy_100g"]);
  const kcal = n(nu["energy-kcal_100g"]) ?? (kj != null ? kj / 4.184 : null);
  const c = n(nu["carbohydrates_100g"]);
  const pr = n(nu["proteins_100g"]);
  const gr = n(nu["fat_100g"]);
  if (kcal == null || (c == null && pr == null && gr == null)) return null;
  const nombre = (p.product_name_es || p.product_name || "").trim();
  if (!nombre) return null;
  const marca = (p.brands ?? "").split(",")[0].trim();
  const az = Math.min(n(nu["sugars_100g"]) ?? 0, c ?? 0);
  const ch = c ?? 0;
  const ig: IG = ch < 5 ? "bajo" : az / Math.max(ch, 1) > 0.5 && ch > 15 ? "alto" : ch > 40 ? "medio" : "medio";
  const rac: string[] = [];
  const serv = n(p.serving_quantity);
  if (serv && serv > 0) rac.push(`1 ración:${Math.round(serv)}`);
  const total = n(p.product_quantity);
  if (total && total > 0 && total <= 1500) rac.push(`1 envase:${Math.round(total)}`);
  if (!rac.length) rac.push("1 ración:100");
  return {
    id: `off-${p.code ?? nombre.toLowerCase().replace(/\W+/g, "-")}`,
    n: marca && !nombre.toLowerCase().includes(marca.toLowerCase()) ? `${nombre} (${marca})` : nombre,
    cat: "producto",
    kcal: Math.round(kcal * 10) / 10, p: pr ?? 0, c: ch, az, fi: n(nu["fiber_100g"]) ?? 0, gr: gr ?? 0,
    ig, syn: [], rac: rac.map(parseRacion), fuente: "off", ean: p.code,
  };
}

async function getJson(url: string, ms = 12000): Promise<any> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally {
    window.clearTimeout(t);
  }
}

export const limpiarEAN = (s: string): string => s.replace(/\D/g, "");
export const eanValido = (s: string): boolean => /^\d{8}$|^\d{12,14}$/.test(s);

export async function productoPorEAN(ean: string): Promise<Food | null> {
  const code = limpiarEAN(ean);
  if (!eanValido(code)) throw new Error("El código debe tener 8, 12, 13 o 14 cifras.");
  let r: any;
  try {
    r = await getJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`);
  } catch {
    throw new Error("No se pudo consultar Open Food Facts. Revisa tu conexión.");
  }
  if (r?.status === 0 || !r?.product) return null;
  return alimentoDeOFF({ ...r.product, code });
}

export async function buscarOFF(q: string): Promise<Food[]> {
  const url = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`;
  let r: any;
  try {
    r = await getJson(url, 15000);
  } catch {
    throw new Error("No se pudo buscar en Open Food Facts ahora mismo.");
  }
  return ((r?.products ?? []) as OFFProducto[]).map(alimentoDeOFF).filter((f): f is Food => !!f);
}

/* ---------------- Código de barras ---------------- */
type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o?: { formats?: string[] }) => Detector;
const Ctor = (): DetectorCtor | undefined => (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
export const barcodeSoportado = (): boolean => typeof window !== "undefined" && !!Ctor();

function nuevoDetector(): Detector | null {
  const C = Ctor();
  if (!C) return null;
  try { return new C({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }); } catch { return new C(); }
}

/** Lee un código desde una foto (si el navegador sabe). */
export async function codigoDeFoto(file: Blob): Promise<string | null> {
  const d = nuevoDetector();
  if (!d) return null;
  const bmp = await createImageBitmap(file);
  const res = await d.detect(bmp);
  return res[0]?.rawValue ?? null;
}

/** Cámara en directo: llama a onCode con el primer código leído. Devuelve una función para parar. */
export async function iniciarCamara(video: HTMLVideoElement, onCode: (c: string) => void): Promise<() => void> {
  const d = nuevoDetector();
  if (!d) throw new Error("Este navegador no lee códigos de barras.");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  await video.play();
  let vivo = true;
  const bucle = async () => {
    while (vivo) {
      try {
        const r = await d.detect(video);
        if (r[0]?.rawValue) { vivo = false; onCode(r[0].rawValue); break; }
      } catch { /* sigue intentando */ }
      await new Promise((ok) => setTimeout(ok, 250));
    }
  };
  void bucle();
  return () => {
    vivo = false;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
}
