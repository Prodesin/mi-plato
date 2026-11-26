/* Mi plato — raíz de la aplicación: rail vertical, pantallas y hoja de revisión (estado en memoria + borrador guardado). */
import { useEffect, useRef, useState } from "preact/hooks";
import { Ajustes } from "./ajustes";
import { Alimentos } from "./alimentos";
import { crearBorrador, useIA } from "./analizar";
import { reducirImagen } from "./ai";
import { type Draft, draftVacio, itemDe, useDatos } from "./data";
import { Escaner } from "./escaner";
import { Hoy } from "./hoy";
import { ConfirmDialog, Toast, toast } from "./kit";
import { Resumen } from "./resumen";
import { Revision } from "./revision";
import { Semana } from "./semana";
import type { Fav, Food, Meal } from "./types";
import { isoDate, uid } from "./util";

type Tab = "resumen" | "hoy" | "semana" | "alimentos" | "ajustes";
const I = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>;
const TABS: { id: Tab; label: string; icon: preact.JSX.Element }[] = [
  { id: "resumen", label: "Resumen", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /></svg> },
  { id: "hoy", label: "Hoy", icon: I("M5 7h14M5 12h14M5 17h8") },
  { id: "semana", label: "Semana", icon: I("M5 20V11M10 20V5M15 20v-7M20 20V8") },
  { id: "alimentos", label: "Alimentos", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg> },
  { id: "ajustes", label: "Más", icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="18.5" cy="12" r="1.9" /></svg> },
];

export default function App() {
  const datos = useDatos();
  const ia = useIA(datos);
  const [tab, setTab] = useState<Tab>("resumen");
  const [fecha, setFecha] = useState(isoDate());
  const [escaner, setEscaner] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [foco, setFoco] = useState(0);
  const [fotoBusy, setFotoBusy] = useState(false);
  const hoyRef = useRef(isoDate());
  const rev = datos.borrador.rev;

  useEffect(() => {
    const on = () => {
      const h = isoDate();
      if (h !== hoyRef.current) {
        setFecha((f) => (f === hoyRef.current ? h : f));
        hoyRef.current = h;
      }
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  // Gemini ya no ofrece los modelos 2.5 a claves nuevas: quien lo tuviera guardado pasa al valor por defecto
  useEffect(() => {
    const m = datos.ajustes.modelos.gemini;
    if (m && /^gemini-2\./.test(m)) datos.setAjustes((a) => ({ ...a, modelos: { ...a.modelos, gemini: "" } }));
  }, [datos.ajustes.modelos.gemini]);

  const abrir = (d: Draft) => datos.setBorrador((b) => ({ ...b, rev: d }));
  const setDraft = (f: (d: Draft) => Draft) => datos.setBorrador((b) => ({ ...b, rev: b.rev ? f(b.rev) : b.rev }));
  const cerrar = () => datos.setBorrador((b) => ({ ...b, rev: null }));

  function guardar(d: Draft) {
    const items = d.items.filter((i) => i.g > 0).map(({ cambiado: _c, aviso: _a, ...i }) => i);
    if (!items.length) return toast("No hay nada que guardar: añade algún alimento.", true);
    const num = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : undefined; };
    const meal: Meal = {
      id: d.editId ?? uid(), fecha: d.fecha, hora: d.hora || "13:30", toma: d.toma, texto: d.texto, items,
      glucAntes: num(d.glucAntes), glucDespues: num(d.glucDespues), nota: d.nota.trim() || undefined, iaCorr: d.iaCorr.length ? d.iaCorr : undefined,
    };
    datos.setComidas((l) => (d.editId ? l.map((m) => (m.id === d.editId ? meal : m)) : [...l, meal]));
    // La próxima vez, su ración habitual
    const aprendidas: Record<string, number> = {};
    for (const i of d.items) if (i.cambiado && i.def && i.foodId && i.fuente !== "ia" && i.g > 0) aprendidas[i.foodId] = Math.round(i.g);
    if (Object.keys(aprendidas).length) datos.setHabituales((h) => ({ ...h, ...aprendidas }));
    if (d.fav && d.favNombre.trim()) {
      const fav: Fav = { id: uid(), nombre: d.favNombre.trim(), toma: d.toma, items: items.map((i) => ({ ...i, id: uid() })) };
      datos.setFavs((l) => [fav, ...l]);
    }
    datos.setBorrador((b) => ({ texto: !d.editId && d.texto && d.texto === b.texto ? "" : b.texto, rev: null }));
    setFecha(d.fecha);
    setTab("hoy");
    toast(d.editId ? "Cambios guardados." : "Guardado en " + (d.toma === "otro" ? "tu día" : d.toma) + ".");
  }

  /** Foto del plato → Gemini (u otro proveedor activo) → «Tu comida» editable. */
  async function analizarFoto(f: File) {
    if (!ia.activa) {
      toast("Para analizar fotos conecta Gemini: pega tu clave gratis en Más → Inteligencia artificial.", true);
      setTab("ajustes");
      return;
    }
    setFotoBusy(true);
    try {
      const img = await reducirImagen(f);
      const d = await crearBorrador({ texto: datos.borrador.texto, imagenes: [img], datos, ia, fecha });
      if (!d.items.length && !d.pend.length) d.iaError = d.iaError ?? "No he reconocido nada en la foto. Prueba con otra o escribe lo que hay en el plato.";
      abrir(d);
    } catch (err) {
      toast((err as Error).message || "No se pudo leer la foto.", true);
    }
    setFotoBusy(false);
  }
  function anadirComida() {
    setTab("hoy");
    setFoco((n) => n + 1);
  }

  function usarProducto(f: Food) {
    datos.setPropios((l) => (l.some((x) => x.id === f.id) ? l : [f, ...l]));
    const d = draftVacio(fecha, "producto");
    d.items = [itemDe(f, f.rac[0]?.g ?? 100)];
    setEscaner(false);
    abrir(d);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = TABS.findIndex((t) => t.id === tab);
    const n = TABS[(i + (e.key === "ArrowDown" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(n.id);
    e.preventDefault();
    (document.getElementById(`tab-${n.id}`) as HTMLElement | null)?.focus();
  }

  return (
    <>
      <main class="areas">
        <section id="area-resumen" class="area" role="tabpanel" aria-labelledby="tab-resumen" hidden={tab !== "resumen"}>
          <h1 class="vh">Resumen</h1>
          <Resumen datos={datos} irAHoy={() => { setFecha(isoDate()); setTab("hoy"); }} anadir={() => { setFecha(isoDate()); anadirComida(); }} foto={analizarFoto} fotoBusy={fotoBusy} />
        </section>
        <section id="area-hoy" class="area" role="tabpanel" aria-labelledby="tab-hoy" hidden={tab !== "hoy"}>
          <h1 class="vh">Hoy</h1>
          <Hoy datos={datos} fecha={fecha} setFecha={setFecha} abrir={abrir} ia={ia} abrirEscaner={() => setEscaner(true)} foco={foco} onFoto={analizarFoto} fotoBusy={fotoBusy} />
        </section>
        <section id="area-semana" class="area" role="tabpanel" aria-labelledby="tab-semana" hidden={tab !== "semana"}>
          <h1 class="vh">Semana</h1>
          <Semana datos={datos} ia={ia} irADia={(f) => { setFecha(f); setTab("hoy"); }} />
        </section>
        <section id="area-alimentos" class="area" role="tabpanel" aria-labelledby="tab-alimentos" hidden={tab !== "alimentos"}>
          <h1 class="vh">Alimentos</h1>
          <Alimentos datos={datos} abrir={abrir} abrirEscaner={() => setEscaner(true)} fecha={fecha} />
        </section>
        <section id="area-ajustes" class="area" role="tabpanel" aria-labelledby="tab-ajustes" hidden={tab !== "ajustes"}>
          <h1 class="vh">Más</h1>
          <Ajustes datos={datos} />
        </section>
      </main>
      <nav class="tabbar" role="tablist" aria-orientation="vertical" aria-label="Secciones" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`area-${t.id}`} aria-label={t.label} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
      {rev ? (
        <Revision draft={rev} setDraft={setDraft} datos={datos} onSave={guardar} onCancel={cerrar} onDelete={rev.editId ? () => setBorrando(true) : undefined} />
      ) : null}
      {escaner ? <Escaner onUsar={usarProducto} onCerrar={() => setEscaner(false)} /> : null}
      <ConfirmDialog open={borrando} title="¿Borrar esta comida?" body={<p>Se quitará de tu día. No se puede deshacer.</p>} confirmLabel="Borrar" danger onCancel={() => setBorrando(false)}
        onConfirm={() => { if (rev?.editId) datos.setComidas((l) => l.filter((m) => m.id !== rev.editId)); setBorrando(false); cerrar(); toast("Comida borrada."); }} />
      <Toast />
    </>
  );
}
