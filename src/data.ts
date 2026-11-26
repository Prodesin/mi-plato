/* Estado de la aplicación: perfil, comidas, favoritos, alimentos propios, ajustes y borrador. */
import { useMemo } from "preact/hooks";
import { FOODS } from "./foods";
import { itemDeAlimento, topFrecuentes } from "./coach";
import { calcGramos, parseMeal, type Cantidad } from "./parser";
import { usePersist } from "./store";
import type { Ajustes, Correccion, Fav, Food, Item, Meal, Perfil, Toma } from "./types";
import { AJUSTES_DEF, PERFIL_JORGE, tomaPorHora } from "./types";
import { horaAhora, isoDate, uid } from "./util";

export type Pend = { id: string; texto: string; cant: Cantidad };
export type Draft = {
  editId?: string;
  fecha: string; hora: string; toma: Toma; tomaManual: boolean;
  texto: string;
  items: Item[]; pend: Pend[];
  glucAntes: string; glucDespues: string; nota: string;
  iaCorr: Correccion[]; iaResumen?: string; iaError?: string;
  origen: "texto" | "foto" | "frecuente" | "favorito" | "repetir" | "manual" | "producto" | "opcion";
  fav: boolean; favNombre: string;
};
export type Borrador = { texto: string; rev: Draft | null };

export function useDatos() {
  const [perfil, setPerfil] = usePersist<Perfil>("perfil", PERFIL_JORGE);
  const [comidas, setComidas] = usePersist<Meal[]>("comidas", []);
  const [favs, setFavs] = usePersist<Fav[]>("favs", []);
  const [propios, setPropios] = usePersist<Food[]>("propios", []);
  const [habituales, setHabituales] = usePersist<Record<string, number>>("habituales", {});
  const [ajustes, setAjustes] = usePersist<Ajustes>("ajustes", AJUSTES_DEF);
  const [borrador, setBorrador] = usePersist<Borrador>("borrador", { texto: "", rev: null });
  const catalogo = useMemo(() => {
    const m = new Map<string, Food>();
    for (const f of FOODS) m.set(f.id, f);
    for (const f of propios) m.set(f.id, f);
    return m;
  }, [propios]);
  const lista = useMemo(() => [...propios, ...FOODS.filter((f) => !propios.some((p) => p.id === f.id))], [propios]);
  const frecuentes = useMemo(() => topFrecuentes(comidas, 30), [comidas]);
  const perfilOk: Perfil = { ...PERFIL_JORGE, ...perfil };
  const ajustesOk: Ajustes = { ...AJUSTES_DEF, ...ajustes };
  return { perfil: perfilOk, setPerfil, comidas, setComidas, favs, setFavs, propios, setPropios, habituales, setHabituales, ajustes: ajustesOk, setAjustes, borrador, setBorrador, catalogo, lista, frecuentes };
}
export type Datos = ReturnType<typeof useDatos>;

export function draftVacio(fecha: string, origen: Draft["origen"], texto = ""): Draft {
  const hora = fecha === isoDate() ? horaAhora() : "13:30";
  return { fecha, hora, toma: tomaPorHora(hora), tomaManual: false, texto, items: [], pend: [], glucAntes: "", glucDespues: "", nota: "", iaCorr: [], origen, fav: false, favNombre: "" };
}

export function itemDe(f: Food, g: number, extra: Partial<Item> = {}): Item {
  return { ...itemDeAlimento(f, g, uid()), ...extra };
}

/** Borrador a partir de texto libre con el parser local. */
export function draftDeTexto(texto: string, fecha: string, d: Pick<Datos, "lista" | "habituales">): Draft {
  const dr = draftVacio(fecha, "texto", texto);
  for (const p of parseMeal(texto, d.lista, { habituales: d.habituales })) {
    if (p.food) dr.items.push(itemDe(p.food, p.g, { def: p.def, texto: p.texto }));
    else dr.pend.push({ id: uid(), texto: p.texto, cant: p.cant });
  }
  return dr;
}

export function itemsDeFavorito(f: Fav): Item[] {
  return f.items.map((i) => ({ ...i, id: uid() }));
}
export function gramosPara(food: Food, cant: Cantidad, habituales: Record<string, number>): number {
  return calcGramos(food, cant, habituales);
}
