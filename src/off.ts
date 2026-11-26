/* Open Food Facts: productos por código de barras (EAN) y por nombre, con cámara (BarcodeDetector) o foto. */
import { parseRacion } from "./foods";
import type { Food, IG } from "./types";
import { estimarFibra } from "./util";

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
  const fib = n(nu["fiber_100g"]);
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
    kcal: Math.round(kcal * 10) / 10, p: pr ?? 0, c: ch, az, fi: fib ?? estimarFibra(ch, az), fiEst: fib == null && ch >= 5 ? true : undefined, gr: gr ?? 0,
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
/** Hay lector nativo (Chrome/Android). En Safari/iOS se usa ZXing (zxing.js, cargado bajo demanda). */
export const barcodeSoportado = (): boolean => typeof window !== "undefined" && !!Ctor();
export const camaraDisponible = (): boolean => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function nuevoDetector(): Detector | null {
  const C = Ctor();
  if (!C) return null;
  try { return new C({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }); } catch { return new C(); }
}

type ZX = { decodificar(c: HTMLCanvasElement): string | null };
let zxPromesa: Promise<ZX> | null = null;
/** Carga zxing.js (mismo origen, lo guarda el service worker) una sola vez. */
export function cargarZXing(): Promise<ZX> {
  const w = window as unknown as { MiPlatoZXing?: ZX };
  if (w.MiPlatoZXing) return Promise.resolve(w.MiPlatoZXing);
  zxPromesa ??= new Promise<ZX>((ok, ko) => {
    const s = document.createElement("script");
    s.src = "./zxing.js";
    s.onload = () => (w.MiPlatoZXing ? ok(w.MiPlatoZXing) : ko(new Error("zxing")));
    s.onerror = () => { zxPromesa = null; ko(new Error("zxing")); };
    document.head.appendChild(s);
  });
  return zxPromesa;
}

/** Lee un código desde una foto: lector nativo si existe y, si no, ZXing (probando varios tamaños y giros). */
export async function codigoDeFoto(file: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const d = nuevoDetector();
  if (d) {
    try { const r = await d.detect(bmp); if (r[0]?.rawValue) return r[0].rawValue; } catch { /* sigue con ZXing */ }
  }
  const zx = await cargarZXing();
  for (const max of [1280, 800, 1920]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    for (const giro of [0, 90, 270]) {
      const c = document.createElement("canvas");
      const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
      c.width = giro ? h : w; c.height = giro ? w : h;
      const x = c.getContext("2d")!;
      x.translate(c.width / 2, c.height / 2); x.rotate((giro * Math.PI) / 180); x.drawImage(bmp, -w / 2, -h / 2, w, h);
      const t = zx.decodificar(c);
      if (t) return t;
    }
  }
  return null;
}

export type Camara = { parar: () => void; linterna: boolean; encender: (on: boolean) => Promise<boolean> };

/** Cámara trasera en directo con detección continua. onCode recibe el primer código leído. */
export async function iniciarCamara(video: HTMLVideoElement, onCode: (c: string) => void): Promise<Camara> {
  if (!camaraDisponible()) throw new Error("sin-camara");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  video.muted = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("muted", "");
  video.srcObject = stream;
  let vivo = true;
  const parar = () => { vivo = false; stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
  try {
    await video.play();
    const nativo = nuevoDetector();
    const zx = nativo ? null : await cargarZXing();
    if (!vivo) return { parar, linterna: false, encender: async () => false };
    const lienzo = document.createElement("canvas");
    const bucle = async () => {
      while (vivo) {
        let code: string | null = null;
        try {
          if (nativo) code = (await nativo.detect(video))[0]?.rawValue ?? null;
          else if (video.videoWidth) {
            // recorte central (donde está el marco guía), más pequeño = más rápido
            const vw = video.videoWidth, vh = video.videoHeight;
            const cw = Math.round(vw * 0.9), ch = Math.round(vh * 0.5);
            const k = Math.min(1, 800 / cw);
            lienzo.width = Math.round(cw * k); lienzo.height = Math.round(ch * k);
            lienzo.getContext("2d", { willReadFrequently: true })!.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, lienzo.width, lienzo.height);
            code = zx!.decodificar(lienzo);
          }
        } catch { /* sigue intentando */ }
        if (code && vivo) { vivo = false; try { navigator.vibrate?.(60); } catch { /* iOS no vibra */ } onCode(code); break; }
        await new Promise((ok) => setTimeout(ok, nativo ? 200 : 120));
      }
    };
    void bucle();
  } catch (e) {
    parar();
    throw e;
  }
  const pista = stream.getVideoTracks()[0];
  const linterna = !!(pista && (pista.getCapabilities?.() as { torch?: boolean } | undefined)?.torch);
  const encender = async (on: boolean) => {
    try { await pista.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); return on; } catch { return false; }
  };
  return { parar, linterna, encender };
}
