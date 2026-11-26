/* Tipos de datos compartidos. */
export type IG = "bajo" | "medio" | "alto";
export type Toma = "desayuno" | "comida" | "merienda" | "cena" | "otro";
export type Fuente = "base" | "off" | "ia" | "propio" | "manual";

export type Racion = { n: string; g: number; cant: number; sing: string };
export type Food = {
  id: string;
  n: string; // nombre
  cat: string;
  kcal: number; p: number; c: number; az: number; fi: number; gr: number; // por 100 g (o 100 ml)
  alc?: number; // g de alcohol por 100
  ig: IG;
  syn: string[];
  rac: Racion[];
  fuente: Fuente;
  ean?: string;
  fiEst?: boolean; // fibra estimada (el origen no la daba)
};

export type Por100 = { kcal: number; p: number; c: number; az: number; fi: number; gr: number };
export type Item = {
  id: string;
  foodId: string | null;
  nombre: string;
  g: number;
  por100: Por100;
  ig: IG;
  cat: string;
  fuente: Fuente;
  conf?: "alta" | "media" | "baja";
  nota?: string;
  def?: boolean; // cantidad por defecto (sin número ni unidad)
  texto?: string; // lo que escribió Jorge
  aviso?: string; // desviación frente a la base local
  cambiado?: boolean; // Jorge ha corregido la cantidad
  fiEst?: boolean; // fibra estimada (no venía en la fuente)
  rac?: { sing: string; g: number }; // ración casera propia (p. ej. la que da la IA: «huevo» = 60 g)
};

export type Meal = {
  id: string;
  fecha: string;
  hora: string;
  toma: Toma;
  texto: string;
  items: Item[];
  glucAntes?: number;
  glucDespues?: number;
  nota?: string;
  iaCorr?: Correccion[];
};

export type Correccion = {
  tipo: "ok" | "aviso" | "alerta";
  texto: string; // frase llana
  porque?: string; // una frase
  cifra?: string; // apoyo discreto
  origen: "reglas" | "ia";
  prio?: number;
  accion?: Accion;
};
export type Accion =
  | { t: "anadir"; foodId: string; g: number }
  | { t: "cambiar"; itemId: string; foodId: string; g: number }
  | { t: "gramos"; itemId: string; g: number };

export type Perfil = {
  nombre: string;
  altura: number;
  peso: number;
  kcal: number; kcalMin: number; kcalMax: number;
  prot: number; protMin: number;
  hcMin: number; hcMax: number; hcComida: number;
  fibra: number;
  grMin: number; grMax: number;
};

export const PERFIL_JORGE: Perfil = {
  nombre: "Jorge", altura: 180, peso: 93,
  kcal: 1875, kcalMin: 1850, kcalMax: 1900,
  prot: 150, protMin: 130,
  hcMin: 120, hcMax: 170, hcComida: 50,
  fibra: 30, grMin: 60, grMax: 70,
};

export type Fav = { id: string; nombre: string; toma?: Toma; items: Item[] };

export type Ajustes = {
  usarIA: boolean;
  proveedor: Proveedor;
  modelos: Partial<Record<Proveedor, string>>;
  atajo: string;
  usarAtajo: boolean;
  bienvenida: boolean; // ya cerrada
};
export type Proveedor = "anthropic" | "gemini" | "xai" | "openai";
export const AJUSTES_DEF: Ajustes = { usarIA: false, proveedor: "anthropic", modelos: {}, atajo: "Enviar a Coco", usarAtajo: false, bienvenida: false };

export type Secretos = { claves: Partial<Record<Proveedor, string>>; cocoUrl: string; cocoClave: string };

export const TOMAS: { id: Toma; label: string }[] = [
  { id: "desayuno", label: "Desayuno" },
  { id: "comida", label: "Comida" },
  { id: "merienda", label: "Merienda" },
  { id: "cena", label: "Cena" },
  { id: "otro", label: "Otro" },
];
export const tomaLabel = (t: Toma): string => TOMAS.find((x) => x.id === t)?.label ?? t;

/** Toma automática según la hora (HH:MM). */
export function tomaPorHora(hhmm: string): Toma {
  const [h, m] = hhmm.split(":").map(Number);
  const min = (h || 0) * 60 + (m || 0);
  if (min < 11 * 60 + 30) return "desayuno";
  if (min < 16 * 60 + 30) return "comida";
  if (min < 20 * 60) return "merienda";
  return "cena";
}

export function itemTotales(it: Item): Por100 {
  const k = it.g / 100;
  return { kcal: it.por100.kcal * k, p: it.por100.p * k, c: it.por100.c * k, az: it.por100.az * k, fi: it.por100.fi * k, gr: it.por100.gr * k };
}
export function sumar(items: Item[]): Por100 {
  const t: Por100 = { kcal: 0, p: 0, c: 0, az: 0, fi: 0, gr: 0 };
  for (const it of items) {
    const x = itemTotales(it);
    t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.az += x.az; t.fi += x.fi; t.gr += x.gr;
  }
  return t;
}
