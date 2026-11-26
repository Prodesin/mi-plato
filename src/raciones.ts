/* Raciones caseras: «2 cafés con leche», «½ plato de lentejas». Un alimento = una unidad de casa (su primera ración). */
import { racionLabel } from "./foods";
import type { Food, Item } from "./types";

export const CHIPS_RACION = [0.5, 1, 2, 3];

/** El alimento del catálogo; si es de IA y trae su ración casera, uno sintético con esa ración. */
export function foodDeItem(it: Item, catalogo: Map<string, Food>): Food | undefined {
  const f = it.foodId ? catalogo.get(it.foodId) : undefined;
  if (f?.rac[0] && !it.rac) return f;
  if (it.rac && it.rac.g > 0) {
    const base = f ?? ({ id: it.id, n: it.nombre, cat: it.cat, kcal: it.por100.kcal, p: it.por100.p, c: it.por100.c, az: it.por100.az, fi: it.por100.fi, gr: it.por100.gr, ig: it.ig, syn: [], fuente: it.fuente, rac: [] } as Food);
    return { ...base, rac: [{ n: `1 ${it.rac.sing}`, g: it.rac.g, cant: 1, sing: it.rac.sing }] };
  }
  return f;
}

/** Gramos de «una ración» para el selector: la casera del alimento; si no hay, lo que traía al apuntarlo (o 100 g). */
export function unidadDe(f: Food | undefined, g0: number): number {
  const r = f?.rac[0]?.g;
  if (!r || r <= 0) return Math.max(10, Math.round(g0 / 5) * 5) || 100;
  // cantidad inicial poco redonda y cerca de 1 ración (p. ej. una tostada de 35 g con rebanada de 30 g): esa cantidad es «1 ración»
  const n0 = g0 / r;
  const cerca = Math.max(0.5, Math.round(n0 * 2) / 2);
  return n0 <= 1.5 && Math.abs(n0 - cerca) >= 0.06 ? g0 / cerca : r;
}

/** Texto de la cantidad de un alimento ya apuntado: «2 cafés con leche»; si no cuadra con medias raciones, «350 g». */
export function cantidadItem(it: Item, catalogo: Map<string, Food>): string {
  const f = foodDeItem(it, catalogo);
  const r = f?.rac[0]?.g;
  if (!f || !r) return `${Math.round(it.g)} g`;
  const n = it.g / r;
  const rej = Math.round(n * 2) / 2;
  if (rej > 0 && rej <= 12 && Math.abs(n - rej) < 0.06) return racionLabel(f, rej);
  return `${Math.round(it.g)} g`;
}
