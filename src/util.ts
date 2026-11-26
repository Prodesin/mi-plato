/* Utilidades comunes: formato español, fechas locales, normalización de texto. Sin dependencias del DOM. */
export const NB = " ";

const nf0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
const nf1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);

/** Número con formato español (1.875 · 38,5). */
export function fmt(n: number, dec = 0): string {
  if (!Number.isFinite(n)) return "0";
  if (dec === 0) return nf0.format(Math.round(n));
  if (dec === 1) return nf1.format(Math.round(n * 10) / 10);
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: dec, useGrouping: "always" } as unknown as Intl.NumberFormatOptions).format(n);
}
/** «38 g», «1.875 kcal» con espacio duro. */
export const u = (n: number, unit: string, dec = 0): string => `${fmt(n, dec)}${NB}${unit}`;
export const g = (n: number): string => u(n, "g");
export const kcal = (n: number): string => u(n, "kcal");

export const round5 = (n: number): number => Math.round(n / 5) * 5;
export const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n));

/* ---------- Fechas (siempre locales, formato AAAA-MM-DD) ---------- */
const p2 = (n: number) => String(n).padStart(2, "0");
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}
export function addDays(s: string, n: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
/** Lunes de la semana de la fecha. */
export function weekStart(s: string): string {
  const d = parseIso(s);
  const dow = (d.getDay() + 6) % 7;
  return addDays(s, -dow);
}
export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function dowIndex(s: string): number {
  return (parseIso(s).getDay() + 6) % 7;
}
export function fechaLarga(s: string): string {
  const d = parseIso(s);
  return `${DIAS[dowIndex(s)]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
export function fechaCorta(s: string): string {
  const d = parseIso(s);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}
export function horaAhora(d: Date = new Date()): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Texto ---------- */
/** Minúsculas, sin tildes (la ñ se conserva como n), sin signos raros. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/½/g, " medio ")
    .replace(/¼/g, " cuarto ")
    .replace(/[^a-z0-9.,%+\s\n/;-]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}
/** Singular aproximado de una palabra (solo para comparar). */
export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("ces")) return w.slice(0, -3) + "z";
  if (w.endsWith("es") && /[^aeiou]es$/.test(w) && w.length > 4 && /(ion|or|er|ar|al|ul|ol|il|id|ud)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
export function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
