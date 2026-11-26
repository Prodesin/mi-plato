/* Decodificador de códigos de barras con ZXing para Safari/iOS (no tiene BarcodeDetector).
 * Se compila aparte (zxing.js) y se carga solo al abrir el escáner; el service worker lo guarda para uso sin conexión. */
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";

const hints = new Map<DecodeHintType, unknown>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
hints.set(DecodeHintType.TRY_HARDER, true);
const reader = new MultiFormatReader();
reader.setHints(hints);

/** Intenta leer un código en los píxeles de un lienzo. Devuelve el texto o null. */
function decodificar(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx || !c.width || !c.height) return null;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) lum[j] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, width, height)))).getText();
  } catch {
    return null;
  }
}

(window as unknown as { MiPlatoZXing: { decodificar: typeof decodificar } }).MiPlatoZXing = { decodificar };
