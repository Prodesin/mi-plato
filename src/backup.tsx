/* Copia de seguridad (exportar / importar con validación), enlaces a las apps hermanas y privacidad. */
import { useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { Button, ConfirmDialog, Text, Toggle, toast } from "./kit";
import { getSecretos, replaceAll, setSecretos, snapshot, storageAvailable } from "./store";
import type { Secretos } from "./types";
import { isoDate } from "./util";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isDate = (v: unknown): v is string => isStr(v) && ISO.test(v) && !Number.isNaN(Date.parse(v));
const TOMAS = ["desayuno", "comida", "merienda", "cena", "otro"];

const isPor100 = (x: unknown) => isObj(x) && ["kcal", "p", "c", "az", "fi", "gr"].every((k) => isNum(x[k]));
const isItem = (x: unknown): boolean =>
  isObj(x) && isStr(x.id) && isStr(x.nombre) && isNum(x.g) && x.g >= 0 && x.g < 20000 && isPor100(x.por100) && ["bajo", "medio", "alto"].includes(x.ig as string) && isStr(x.cat) && isStr(x.fuente);
const arr = (check: (x: Record<string, unknown>) => boolean, max = 30000) => (v: unknown) => Array.isArray(v) && v.length <= max && v.every((x) => isObj(x) && check(x));
const optNum = (v: unknown) => v === undefined || v === null || isNum(v);

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
  perfil: (v) => isObj(v) && isStr(v.nombre) && ["altura", "peso", "kcal", "kcalMin", "kcalMax", "prot", "protMin", "hcMin", "hcMax", "hcComida", "fibra", "grMin", "grMax"].every((k) => isNum(v[k])),
  comidas: arr((x) => isStr(x.id) && isDate(x.fecha) && isStr(x.hora) && /^\d{1,2}:\d{2}$/.test(x.hora) && TOMAS.includes(x.toma as string) && isStr(x.texto) && Array.isArray(x.items) && x.items.length < 200 && x.items.every(isItem) && optNum(x.glucAntes) && optNum(x.glucDespues)),
  favs: arr((x) => isStr(x.id) && isStr(x.nombre) && Array.isArray(x.items) && x.items.every(isItem), 2000),
  propios: arr((x) => isStr(x.id) && isStr(x.n) && ["kcal", "p", "c", "az", "fi", "gr"].every((k) => isNum(x[k])) && Array.isArray(x.rac) && Array.isArray(x.syn), 5000),
  habituales: (v) => isObj(v) && Object.values(v).every(isNum),
  ajustes: (v) => isObj(v) && typeof v.usarIA === "boolean",
};
const LABELS: Record<string, string> = { comidas: "comidas apuntadas", favs: "comidas guardadas", propios: "alimentos propios" };

export type ParsedBackup = { data: Record<string, unknown>; secretos?: Secretos; summary: string[]; ignored: number };

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new Error("El archivo no es un JSON válido."); }
  if (!isObj(json) || json.app !== "mi-plato" || !isObj(json.data)) throw new Error("Este archivo no es una copia de Mi plato.");
  if (isNum(json.schema) && json.schema > 1) throw new Error("La copia es de una versión más reciente de la app. Actualiza Mi plato e inténtalo de nuevo.");
  const data: Record<string, unknown> = {};
  const summary: string[] = [];
  let ignored = 0;
  for (const [key, value] of Object.entries(json.data)) {
    const check = VALIDATORS[key];
    if (!check) { ignored += 1; continue; }
    if (!check(value)) throw new Error(`Los datos de «${key}» no son válidos; no se ha importado nada.`);
    data[key] = value;
    if (LABELS[key] && Array.isArray(value)) summary.push(`${value.length} ${LABELS[key]}`);
  }
  if (!Object.keys(data).length) throw new Error("La copia no contiene datos de Mi plato.");
  let secretos: Secretos | undefined;
  if (isObj(json.secretos) && isObj(json.secretos.claves)) {
    const claves: Secretos["claves"] = {};
    for (const [k, v] of Object.entries(json.secretos.claves)) if (["anthropic", "gemini", "xai", "openai"].includes(k) && isStr(v)) claves[k as keyof Secretos["claves"]] = v;
    secretos = { claves, cocoUrl: isStr(json.secretos.cocoUrl) ? json.secretos.cocoUrl : "", cocoClave: isStr(json.secretos.cocoClave) ? json.secretos.cocoClave : "" };
  }
  return { data, secretos, summary, ignored };
}

export function exportBackup(conClaves: boolean): void {
  const d = snapshot();
  delete d.borrador;
  const payload: Record<string, unknown> = { app: "mi-plato", schema: 1, exportedAt: new Date().toISOString(), data: d };
  if (conClaves) payload.secretos = getSecretos();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mi-plato-${isoDate()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(conClaves ? "Copia exportada, con tus claves dentro: guárdala bien." : "Copia de seguridad exportada.");
}

export function Block({ heading, children }: { heading: string; children?: ComponentChildren }) {
  return (
    <section class="ep-card ep-panel">
      <div class="ep-panel__head"><h2 class="block-h">{heading}</h2></div>
      <div class="block-b">{children}</div>
    </section>
  );
}

export function BackupPanel() {
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [wipe, setWipe] = useState(false);
  const [conClaves, setConClaves] = useState(false);

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    try {
      if (f.size > 12 * 1024 * 1024) throw new Error("El archivo es demasiado grande para ser una copia.");
      setPending(parseBackup(await f.text()));
    } catch (err) {
      toast((err as Error).message || "No se pudo leer el archivo.", true);
    }
  }

  return (
    <Block heading="Copia de seguridad">
      <Text>Tus datos están solo en este dispositivo. Exporta una copia de vez en cuando y antes de borrar los datos de Safari.</Text>
      <Toggle label="Incluir mis claves (IA y Coco) en la copia" value={conClaves} onChange={setConClaves} />
      <div class="btn-row">
        <Button label="Exportar copia" variant="primary" onClick={() => exportBackup(conClaves)} />
        <Button label="Importar copia" onClick={() => file.current?.click()} />
        <Button label="Borrar mis datos" onClick={() => setWipe(true)} />
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
      {!storageAvailable() ? <Text>Aviso: este navegador no deja guardar datos; lo que apuntes se perderá al cerrar.</Text> : null}
      <ConfirmDialog
        open={!!pending}
        title="¿Importar la copia?"
        body={<p>Se reemplazarán tus datos actuales por los de la copia{pending && pending.summary.length ? `: ${pending.summary.join(", ")}` : ""}.{pending?.secretos ? " También trae claves guardadas." : ""} Esta acción no se puede deshacer.</p>}
        confirmLabel="Importar"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            replaceAll(pending.data);
            if (pending.secretos) setSecretos(pending.secretos);
            toast("Copia importada correctamente.");
          }
          setPending(null);
        }}
      />
      <ConfirmDialog
        open={wipe}
        title="¿Borrar todos tus datos?"
        body={<p>Se borrarán de este dispositivo tus comidas, favoritos, alimentos propios y ajustes (también las claves). Exporta antes una copia si la quieres.</p>}
        confirmLabel="Borrar"
        danger
        onCancel={() => setWipe(false)}
        onConfirm={() => {
          replaceAll({});
          setSecretos({ claves: {}, cocoUrl: "", cocoClave: "" });
          setWipe(false);
          toast("Datos borrados.");
        }}
      />
    </Block>
  );
}

export function LinksPanel() {
  const L = ({ href, t, s }: { href: string; t: string; s: string }) => (
    <a class="link-row" href={href} target="_blank" rel="noopener">
      <span><b>{t}</b><small>{s}</small></span>
      <i aria-hidden="true">›</i>
    </a>
  );
  return (
    <Block heading="Más apps">
      <L href="https://prodesin.github.io/mi-entrenador/" t="Mi entrenador" s="Fuerza, caminatas y peso" />
      <L href="https://prodesin.github.io/mi-menu/" t="Mi menú" s="Menú semanal y lista de la compra" />
      <L href="https://prodesin.github.io/mi-tension/" t="Mi tensión" s="Registro de tensión arterial" />
      <L href="https://prodesin.github.io/mi-salud/" t="Mi salud" s="Panel diario: tensión, peso, glucosa y medicación" />
    </Block>
  );
}

export function PrivacyPanel() {
  return (
    <Block heading="Privacidad y avisos">
      <Text>
        Mi plato no usa servidor, cuentas, anuncios ni analítica. Lo que apuntas se guarda solo en este dispositivo. La base de alimentos es pública (está en el código de la app). Si activas la IA, el texto o la foto de cada comida se envía al proveedor que elijas, con tu clave.
      </Text>
      <div class="notice">
        <Text>Orientativo: no sustituye a tu médico ni a tu endocrino. Si usas insulina o sulfonilureas, consulta antes de cambiar hidratos.</Text>
      </div>
    </Block>
  );
}
