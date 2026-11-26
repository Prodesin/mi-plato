/* Almacén local de «Mi plato».
 * Todo el estado vive en UNA clave raíz de localStorage ("mi-plato:v1") con versión de esquema:
 *   { "schema": 1, "data": { "comidas": [...], "perfil": {...}, ... } }
 * Los secretos (claves de API, webhook de Coco) van en OTRA clave ("mi-plato:secretos"), que no se exporta por defecto.
 * Varias instancias del mismo hook comparten valor y se sincronizan entre pestañas con el evento «storage». */
import { useCallback, useEffect, useReducer } from "preact/hooks";
import type { Secretos } from "./types";

export const ROOT_KEY = "mi-plato:v1";
export const SECRETOS_KEY = "mi-plato:secretos";
export const SCHEMA = 1;

type Root = { schema: number; data: Record<string, unknown> };

let root: Root | null = null;
const listeners = new Map<string, Set<() => void>>();
let memoryOnly = false;

const emptyRoot = (): Root => ({ schema: SCHEMA, data: {} });

function readRoot(): Root {
  try {
    const raw = window.localStorage.getItem(ROOT_KEY);
    if (!raw) return emptyRoot();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
      return { schema: SCHEMA, data: parsed.data as Record<string, unknown> };
    }
  } catch {
    // JSON corrupto o sin acceso: se parte de cero (no se pisa hasta que haya una escritura).
  }
  return emptyRoot();
}
const getRoot = (): Root => (root ??= readRoot());

function persist(): boolean {
  if (memoryOnly) return false;
  try {
    window.localStorage.setItem(ROOT_KEY, JSON.stringify(getRoot()));
    return true;
  } catch {
    memoryOnly = true;
    return false;
  }
}
function notify(key?: string) {
  if (key) listeners.get(key)?.forEach((fn) => fn());
  else listeners.forEach((set) => set.forEach((fn) => fn()));
}

export function getValue<T>(key: string, fallback: T): T {
  const v = getRoot().data[key];
  return v === undefined ? fallback : (v as T);
}
export function setValue<T>(key: string, value: T): void {
  getRoot().data[key] = value;
  persist();
  notify(key);
}
export function snapshot(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(getRoot().data));
}
export function replaceAll(data: Record<string, unknown>): void {
  root = { schema: SCHEMA, data };
  persist();
  notify();
}
export const storageAvailable = (): boolean => !memoryOnly;

/* ---------------- Secretos ---------------- */
const SECRETOS_DEF: Secretos = { claves: {}, cocoUrl: "", cocoClave: "" };
let secretos: Secretos | null = null;
const secListeners = new Set<() => void>();
export function getSecretos(): Secretos {
  if (secretos) return secretos;
  try {
    const raw = window.localStorage.getItem(SECRETOS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    secretos = p && typeof p === "object" ? { claves: p.claves && typeof p.claves === "object" ? p.claves : {}, cocoUrl: String(p.cocoUrl ?? ""), cocoClave: String(p.cocoClave ?? "") } : { ...SECRETOS_DEF, claves: {} };
  } catch {
    secretos = { ...SECRETOS_DEF, claves: {} };
  }
  return secretos;
}
export function setSecretos(next: Secretos): void {
  secretos = next;
  try { window.localStorage.setItem(SECRETOS_KEY, JSON.stringify(next)); } catch { /* sin espacio */ }
  secListeners.forEach((f) => f());
}
export function useSecretos(): [Secretos, (s: Secretos) => void] {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    secListeners.add(force as () => void);
    return () => { secListeners.delete(force as () => void); };
  }, []);
  return [getSecretos(), setSecretos];
}
export function borrarSecretos(): void {
  secretos = { ...SECRETOS_DEF, claves: {} };
  try { window.localStorage.removeItem(SECRETOS_KEY); } catch { /* nada */ }
  secListeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ROOT_KEY || e.key === null) {
      root = null;
      notify();
    }
    if (e.key === SECRETOS_KEY || e.key === null) {
      secretos = null;
      secListeners.forEach((f) => f());
    }
  });
}

type Action<T> = T | ((prev: T) => T);

/** Estado persistente compartido por clave. */
export function usePersist<T>(key: string, defaultValue: T): [T, (action: Action<T>) => void] {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(force as () => void);
    return () => { set!.delete(force as () => void); };
  }, [key]);
  const set = useCallback((action: Action<T>) => {
    const prev = getValue<T>(key, defaultValue);
    const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
    setValue(key, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [getValue<T>(key, defaultValue), set];
}
