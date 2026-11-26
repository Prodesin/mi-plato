/* Pantalla «Hoy»: anillos, caja «¿Qué estás comiendo?», qué comer ahora y comidas del día con correcciones. */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { revisionConIA, resumenTexto, ErrorIA } from "./ai";
import { crearBorrador } from "./analizar";
import { Anillo } from "./charts";
import { agruparTomas, fraseRestante, queComer, revisionDia, siguienteToma, totalesDia, corregirComida, type MealToma, type Opcion } from "./coach";
import { CompartirCoco } from "./compartir";
import { type Datos, type Draft, draftVacio, itemDe, itemsDeFavorito } from "./data";
import { Button, Segmented, toast, useGrokTheme } from "./kit";
import { cantidadItem } from "./raciones";
import { Corr } from "./revision";
import type { Correccion, Food, Item, Meal } from "./types";
import { TOMAS, itemTotales, sumar, tomaLabel, tomaPorHora } from "./types";
import { addDays, fechaLarga, fechaMedia, fmt, horaAhora, isoDate, kcal as ktxt, uid } from "./util";

type IA = { activa: boolean; cfg: import("./ai").Cfg };
const EJEMPLOS = ["dos huevos, una tostada de pan integral y café con leche", "un plato de lentejas con una manzana", "ensalada con atún y un chorrito de aceite, y una cerveza"];

const SR = (): any => (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function Hoy({ datos, fecha, setFecha, abrir, ia, abrirEscaner, foco, onFoto, fotoBusy }: { datos: Datos; fecha: string; setFecha: (f: string) => void; abrir: (d: Draft) => void; ia: IA; abrirEscaner: () => void; foco: number; onFoto: (f: File) => void; fotoBusy: boolean }) {
  const th = useGrokTheme();
  const { perfil, comidas, borrador, setBorrador, ajustes, setAjustes } = datos;
  const texto = borrador.texto;
  const setTexto = (t: string) => setBorrador((b) => ({ ...b, texto: t }));
  const [cargando, setCargando] = useState(false);
  const [atajo, setAtajo] = useState<"frecuentes" | "favoritos" | "recientes">("frecuentes");
  const [escuchando, setEscuchando] = useState(false);
  const [excluir, setExcluir] = useState<string[]>([]);
  const [revIA, setRevIA] = useState<{ fecha: string; corr: Correccion[]; resumen: string } | null>(null);
  const [revCargando, setRevCargando] = useState(false);
  const rec = useRef<any>(null);
  const foto = useRef<HTMLInputElement>(null);
  const esHoy = fecha === isoDate();
  const hora = horaAhora();

  const delDia = useMemo(() => comidas.filter((m) => m.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora)), [comidas, fecha]);
  const tomasDia = useMemo(() => agruparTomas(delDia), [delDia]); // apuntes cercanos = una sola comida
  const tot = totalesDia(delDia);
  const frecIds = useMemo(() => datos.frecuentes.filter((f) => f.foodId).map((f) => f.foodId!), [datos.frecuentes]);
  const toma = siguienteToma(delDia, hora);
  const frase = fraseRestante(perfil, tot, esHoy ? toma : null, delDia.length > 0);
  const resumen = useMemo(() => revisionDia(delDia, perfil), [delDia, perfil]);
  const sugerencias = useMemo(
    () => (esHoy ? queComer({ perfil, dia: delDia, toma, frecuentes: frecIds, catalogo: datos.catalogo, excluir }) : { opciones: [] as Opcion[] }),
    [esHoy, perfil, delDia, toma, frecIds, datos.catalogo, excluir],
  );
  const primeraVez = comidas.length === 0 && !ajustes.bienvenida;

  useEffect(() => () => rec.current?.stop?.(), []);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (foco > 0) ta.current?.focus(); }, [foco]);

  async function analizar(t = texto, imagenes: string[] = []) {
    if (!t.trim() && !imagenes.length) return toast("Escribe primero lo que estás comiendo.", true);
    setCargando(true);
    try {
      const d = await crearBorrador({ texto: t, imagenes, datos, ia, fecha });
      if (!d.items.length && !d.pend.length) {
        d.iaError = d.iaError ?? "No he reconocido nada en el texto. Prueba con otras palabras o añádelo a mano.";
      }
      abrir(d);
    } finally {
      setCargando(false);
    }
  }
  function alElegirFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = "";
    if (f) onFoto(f);
  }
  function micro() {
    const R = SR();
    if (!R) return;
    if (escuchando) { rec.current?.stop?.(); return; }
    const r = new R();
    r.lang = "es-ES"; r.interimResults = false; r.continuous = false;
    r.onresult = (ev: any) => {
      const t = Array.from(ev.results).map((x: any) => x[0].transcript).join(" ").trim();
      if (t) setBorrador((b) => ({ ...b, texto: (b.texto ? b.texto.replace(/\s+$/, "") + ", " : "") + t }));
    };
    r.onend = () => setEscuchando(false);
    r.onerror = () => { setEscuchando(false); toast("No he podido oírte. Prueba otra vez o escribe.", true); };
    rec.current = r;
    setEscuchando(true);
    try { r.start(); } catch { setEscuchando(false); }
  }

  function desdeFrecuente(foodId: string) {
    const f = datos.catalogo.get(foodId);
    if (!f) return;
    const d = draftVacio(fecha, "frecuente");
    d.items = [itemDe(f, datos.habituales[f.id] ?? datos.frecuentes.find((x) => x.foodId === foodId)?.g ?? f.rac[0]?.g ?? 100, { def: false })];
    abrir(d);
  }
  function desdeMeal(m: Meal, origen: Draft["origen"]) {
    const d = draftVacio(fecha, origen);
    d.items = m.items.map((i) => ({ ...i, id: uid(), cambiado: false }));
    d.toma = m.toma; d.tomaManual = true; d.texto = m.texto;
    abrir(d);
  }
  function opcion(o: Opcion) {
    const d = draftVacio(fecha, "opcion");
    d.toma = toma; d.tomaManual = true;
    d.items = o.items.map((i) => itemDe(datos.catalogo.get(i.foodId)!, i.g));
    abrir(d);
  }
  const recientes = useMemo(() => {
    const vistos = new Set<string>();
    const out: Meal[] = [];
    for (const m of [...comidas].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))) {
      if (m.fecha === fecha) continue;
      const k = m.items.map((i) => i.foodId ?? i.nombre).join("|");
      if (vistos.has(k)) continue;
      vistos.add(k); out.push(m);
      if (out.length >= 8) break;
    }
    return out;
  }, [comidas, fecha]);

  async function revisionIA() {
    if (!ia.activa) return toast("Activa la IA en Ajustes para pedir esta revisión.", true);
    if (!delDia.length) return toast("Apunta antes alguna comida.", true);
    setRevCargando(true);
    try {
      const r = await revisionConIA(ia.cfg, { perfil, hoy: delDia, historial: comidas, toma, hora }, resumenTexto(delDia));
      setRevIA({ fecha, corr: r.correcciones.map((c) => ({ ...c, origen: "ia" as const })), resumen: r.resumen });
    } catch (e) {
      toast((e instanceof ErrorIA ? e.message : "No se pudo conectar: revisa la clave.") + " Te dejo la revisión sin IA.", true);
    }
    setRevCargando(false);
  }

  // Semáforo inteligente para anillos
  const horaNum = (() => {
    const [h, m] = hora.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  })();
  const pctEsperado = horaNum <= 12 ? 0.35 : horaNum <= 16 ? 0.6 : horaNum <= 20 ? 0.8 : 1.0;
  
  const colorKcal = tot.kcal > perfil.kcal * 1.15 ? th.text.danger : (tot.kcal >= perfil.kcal * pctEsperado * 0.85 ? th.text.success : th.text.warning);
  const colorProt = tot.p > perfil.prot * 1.15 ? th.text.danger : (tot.p >= perfil.prot * pctEsperado * 0.85 ? th.text.success : th.text.warning);
  const colorHc = tot.c > perfil.hcMax * 1.15 ? th.text.danger : (tot.c <= perfil.hcMax ? th.text.success : th.text.warning);
  const colorFibra = tot.fi >= perfil.fibra * pctEsperado * 0.8 ? th.text.success : th.text.warning;

  return (
    <div class="cols">
      <div class="col col-a">
        <div class="item" style={{ order: 0 }}>
          <div class="daynav apple-header">
            <div class="apple-title-wrap">
              <h1 class="apple-large-title">Hoy</h1>
              <small class="apple-date"><span class="d-largo">{fechaLarga(fecha)}</span><span class="d-corto">{fechaMedia(fecha)}</span></small>
            </div>
            <div class="daynav__controls">
              <button type="button" class="icon-btn" aria-label="Día anterior" onClick={() => setFecha(addDays(fecha, -1))}>‹</button>
              <button type="button" class="icon-btn" aria-label="Día siguiente" disabled={fecha >= isoDate()} onClick={() => setFecha(addDays(fecha, 1))}>›</button>
              {!esHoy ? <button type="button" class="link-btn" onClick={() => setFecha(isoDate())}>Hoy</button> : null}
            </div>
          </div>
        </div>

        {primeraVez ? (
          <section class="ep-card welcome" style={{ order: 1 }}>
            <h2 class="card-h">Hola, {perfil.nombre}</h2>
            <p class="k-text">Cuéntame lo que estás comiendo y te digo cómo mejorarlo con pequeños cambios.</p>
            <ul class="ejemplos">{EJEMPLOS.map((e) => <li key={e}><button type="button" onClick={() => { setTexto(e); void analizar(e); }}>{e}</button></li>)}</ul>
            <div class="btn-row"><Button label="Entendido" onClick={() => setAjustes((a) => ({ ...a, bienvenida: true }))} /></div>
          </section>
        ) : null}

        <section class="ep-card day-sum" style={{ order: 2 }} aria-label="Resumen del día">
          <div class="rings">
            <Anillo valor={tot.kcal} objetivo={perfil.kcal} etiqueta="calorías" unidad="kcal" color={colorKcal} />
            <Anillo valor={tot.p} objetivo={perfil.prot} etiqueta="proteína" unidad="g" color={colorProt} />
            <Anillo valor={tot.c} objetivo={perfil.hcMax} etiqueta="hidratos" unidad="g" color={colorHc} />
            <Anillo valor={tot.fi} objetivo={perfil.fibra} etiqueta="fibra" unidad="g" color={colorFibra} />
          </div>
          <p class="day-sum__frase" aria-live="polite">{frase}</p>
        </section>

        {esHoy && sugerencias.opciones.length > 0 ? (
          <section class="ep-card ahora" style={{ order: 3 }}>
            <div class="ahora__head">
              <h2 class="card-h">Consejo</h2>
              <span class="ahora__badge">Recomendado</span>
            </div>
            <p class="ahora__tit">{sugerencias.opciones[0].titulo}</p>
            <p class="ahora__why">{sugerencias.opciones[0].porque}</p>
            <details class="ahora__det">
              <summary>Ver más</summary>
              <ul class="opciones">
                {sugerencias.opciones.slice(1, 4).map((o) => (
                  <li key={o.titulo}>
                    <b>{o.titulo}</b>
                    <span class="corr__why">{o.porque}</span>
                    <button type="button" class="corr__btn" onClick={() => opcion(o)}>Elegir</button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ) : null}

        <section class="ep-card entrada" style={{ order: 4 }}>
          <div class="entrada__box">
            <textarea ref={ta} class="k-input entrada__ta" rows={2} autoCapitalize="sentences" placeholder="¿Qué estás comiendo?" aria-label="¿Qué estás comiendo?" value={texto} onInput={(e) => setTexto((e.currentTarget as HTMLTextAreaElement).value)} />
            <div class="entrada__icons">
              {SR() ? <button type="button" class={`icon-btn small${escuchando ? " on" : ""}`} aria-label={escuchando ? "Parar dictado" : "Dictar"} onClick={micro}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></button> : null}
              <button type="button" class="icon-btn small" aria-label="Escanear código de barras" onClick={abrirEscaner}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" /></svg></button>
              <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={alElegirFoto} />
            </div>
          </div>
          <div class="entrada__bar">
            <Button label={cargando ? "Analizando…" : "Corregir mi comida"} variant="primary" disabled={cargando} onClick={() => analizar()} />
            <button type="button" class="k-btn entrada__foto" disabled={fotoBusy} onClick={() => foto.current?.click()}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              {fotoBusy ? "Analizando…" : "Foto del plato"}
            </button>
          </div>
          <div class="atajos">
            <Segmented options={[{ value: "frecuentes", label: "Lo de siempre" }, { value: "favoritos", label: "Favoritos" }, { value: "recientes", label: "Repetir" }]} value={atajo} onChange={setAtajo} />
            <div class="chips-row">
              {atajo === "frecuentes" ? (
                datos.frecuentes.filter((f) => f.foodId && datos.catalogo.has(f.foodId)).length ? datos.frecuentes.filter((f) => f.foodId && datos.catalogo.has(f.foodId)).slice(0, 8).map((f) => <button type="button" class="chip-btn" key={f.clave} onClick={() => desdeFrecuente(f.foodId!)}>{f.nombre.toLowerCase()}</button>) : <p class="k-text muted tiny">Lo que más tomas aparecerá aquí.</p>
              ) : null}
              {atajo === "favoritos" ? (
                datos.favs.length ? datos.favs.map((f) => <button type="button" class="chip-btn" key={f.id} onClick={() => { const d = draftVacio(fecha, "favorito"); d.items = itemsDeFavorito(f); if (f.toma) { d.toma = f.toma; d.tomaManual = true; } abrir(d); }}>{f.nombre}</button>) : <p class="k-text muted tiny">Guarda tus platos favoritos.</p>
              ) : null}
              {atajo === "recientes" ? (
                recientes.length ? recientes.map((m) => <button type="button" class="chip-btn" key={m.id} onClick={() => desdeMeal(m, "repetir")}>{fechaLarga(m.fecha).split(" ").slice(0, 2).join(" ")} · {m.items[0]?.nombre.toLowerCase()}</button>) : <p class="k-text muted tiny">Repite comidas anteriores.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div class="col col-b">
        <section class="ep-card" style={{ order: 5 }}>
          <h2 class="card-h">Comidas</h2>
          {delDia.length === 0 ? <p class="k-text muted">Ninguna comida registrada hoy.</p> : (
            <ul class="meals">
              {tomasDia.map((m) => <MealCard key={m.id} m={m} datos={datos} otras={tomasDia.filter((x) => x.id !== m.id)} frecIds={frecIds} onEditar={(a) => abrir({ editId: a.id, fecha: a.fecha, hora: a.hora, toma: a.toma, tomaManual: true, texto: a.texto, items: a.items.map((i) => ({ ...i })), pend: [], glucAntes: a.glucAntes != null ? String(a.glucAntes) : "", glucDespues: a.glucDespues != null ? String(a.glucDespues) : "", nota: a.nota ?? "", iaCorr: a.iaCorr ?? [], origen: "manual", fav: false, favNombre: "" })} onRepetir={() => desdeMeal(m, "repetir")} />)}
            </ul>
          )}
        </section>

        {delDia.length > 0 ? (
          <section class="ep-card" style={{ order: 6 }}>
            <details class="resumen-plegado">
              <summary class="resumen-plegado__sum">Resumen del día ›</summary>
              <div class="resumen-plegado__body">
                <ul class="corrs">{resumen.slice(0, 1).map((c, i) => <Corr key={i} c={c} />)}</ul>
                {revIA && revIA.fecha === fecha ? (
                  <div class="rev-ia"><p class="k-text">{revIA.resumen}</p><ul class="corrs">{revIA.corr.map((c, i) => <Corr key={i} c={c} />)}</ul></div>
                ) : null}
                <div class="btn-row"><Button label={revCargando ? "Pensando…" : "Revisión con IA"} disabled={revCargando} onClick={revisionIA} /></div>
                <CompartirCoco datos={datos} desde={fecha} hasta={fecha} periodo="dia" />
              </div>
            </details>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** «2 cafés con leche» (o «Pan 350 g» si no cuadra con raciones de casa). */
const lineaItem = (i: Item, cat: Map<string, Food>): string => {
  const q = cantidadItem(i, cat);
  return q.endsWith(" g") ? `${i.nombre} ${q}` : q;
};

function MealCard({ m, datos, otras, frecIds, onEditar, onRepetir }: { m: MealToma; datos: Datos; otras: Meal[]; frecIds: string[]; onEditar: (a: Meal) => void; onRepetir: () => void }) {
  const t = sumar(m.items);
  const corr = useMemo(() => corregirComida(m, { perfil: datos.perfil, dia: otras, frecuentes: frecIds, catalogo: datos.catalogo }), [m, datos.perfil, otras, frecIds, datos.catalogo]);
  const [abierto, setAbierto] = useState(false);
  const emoji = m.toma === "desayuno" ? "☕" : m.toma === "comida" ? "🍽️" : m.toma === "merienda" ? "🍎" : m.toma === "cena" ? "🌙" : "🍴";
  const semaforo = corr.some((c) => c.tipo === "alerta") ? "danger" : corr.some((c) => c.tipo === "aviso") ? "warn" : "success";

  return (
    <li class="meal-compact">
      <div class="meal-compact__main" onClick={() => setAbierto(!abierto)} role="button" tabIndex={0}>
        <span class="meal-compact__ico">{emoji}</span>
        <div class="meal-compact__info">
          <div class="meal-compact__top"><b>{tomaLabel(m.toma)}</b> <small class="muted">{m.hora}{m.apuntes.length > 1 ? ` · ${m.apuntes.length} apuntes` : ""}</small></div>
          <div class="meal-compact__sub">{ktxt(t.kcal)} <span class={`dot dot--${semaforo}`} /></div>
        </div>
        <span class="meal-compact__chevron">{abierto ? "⌄" : "›"}</span>
      </div>
      {abierto ? (
        <div class="meal-compact__details">
          <ul class="meal__items">{m.items.map((i) => <li key={i.id}>{lineaItem(i, datos.catalogo)} <span class="muted">{fmt(itemTotales(i).kcal)} kcal</span></li>)}</ul>
          {corr.length ? <ul class="corrs compact">{corr.map((c, i) => <Corr key={i} c={c} />)}</ul> : null}
          <div class="btn-row">{m.apuntes.length > 1 ? m.apuntes.map((a) => <Button key={a.id} label={`Editar ${a.hora}`} onClick={() => onEditar(a)} />) : <Button label="Editar" onClick={() => onEditar(m.apuntes[0])} />}<Button label="Repetir" onClick={onRepetir} /></div>
        </div>
      ) : null}
    </li>
  );
}
export { tomaPorHora };
