/* Hoja «Revisa lo que has comido»: cantidades editables, correcciones en vivo, toma, glucosa, nota y favorito. */
import { useMemo, useState } from "preact/hooks";
import { Barra } from "./charts";
import { corregirComida, objetivoToma } from "./coach";
import { type Datos, type Draft, itemDe } from "./data";
import { BuscadorAlimento, FormAlimento, FUENTE_TXT, IG_TXT } from "./forms";
import { Button, Input, Segmented, useGrokTheme, toast } from "./kit";
import { calcGramos } from "./parser";
import type { Accion, Correccion, Food, Item, Toma } from "./types";
import { TOMAS, itemTotales, sumar, tomaPorHora } from "./types";
import { fmt, g as gtxt, kcal as ktxt, uid } from "./util";

const ICONO: Record<Correccion["tipo"], string> = { ok: "✓", aviso: "!", alerta: "‼" };


export function Corr({ c, onAplicar }: { c: Correccion; onAplicar?: (a: Accion) => void }) {
  return (
    <li class={`corr corr--${c.tipo}`}>
      <span class="corr__ico" aria-hidden="true">{ICONO[c.tipo]}</span>
      <span class="corr__body">
        <span class="corr__txt">{c.texto}{c.origen === "ia" ? <em class="tag-ia">IA</em> : null}</span>
        {c.porque ? <span class="corr__why">{c.porque}</span> : null}
        {c.cifra ? <small class="corr__fig">{c.cifra}</small> : null}
        {c.accion && onAplicar ? <button type="button" class="corr__btn" onClick={() => onAplicar(c.accion!)}>Hacerlo</button> : null}
      </span>
    </li>
  );
}

function pasoDe(it: Item, f?: Food): number {
  const r = f?.rac[0]?.g;
  if (r) return r <= 100 ? Math.round(r) : r <= 250 ? 25 : 50;
  return Math.max(5, Math.round(it.g / 4 / 5) * 5);
}

export function Revision({ draft, setDraft, datos, onSave, onCancel, onDelete }: {
  draft: Draft;
  setDraft: (f: (d: Draft) => Draft) => void;
  datos: Datos;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const th = useGrokTheme();
  const [anadir, setAnadir] = useState(false);
  const [creando, setCreando] = useState<{ pendId?: string; nombre?: string } | null>(null);
  const { perfil, catalogo, lista } = datos;
  const otras = useMemo(() => datos.comidas.filter((m) => m.fecha === draft.fecha && m.id !== draft.editId), [datos.comidas, draft.fecha, draft.editId]);
  const frecIds = useMemo(() => datos.frecuentes.filter((f) => f.foodId).map((f) => f.foodId!), [datos.frecuentes]);
  const corr = useMemo(
    () => corregirComida({ items: draft.items, toma: draft.toma, hora: draft.hora }, { perfil, dia: otras, frecuentes: frecIds, catalogo }),
    [draft.items, draft.toma, draft.hora, perfil, otras, frecIds, catalogo],
  );
  const tot = sumar(draft.items);
  const T = objetivoToma(draft.toma, perfil);

  const setItem = (id: string, f: (i: Item) => Item) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? f(i) : i)) }));
  const cambiarG = (id: string, g: number) => setItem(id, (i) => ({ ...i, g: Math.max(0, Math.round(g * 10) / 10), cambiado: true }));
  const quitar = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
  const anadirAlimento = (f: Food, g?: number) => setDraft((d) => ({ ...d, items: [...d.items, itemDe(f, g ?? f.rac[0]?.g ?? 100, { def: false })] }));

  function aplicar(a: Accion) {
    if (a.t === "anadir") {
      const f = catalogo.get(a.foodId);
      if (f) anadirAlimento(f, a.g);
    } else if (a.t === "gramos") {
      cambiarG(a.itemId, a.g);
    } else if (a.t === "cambiar") {
      const f = catalogo.get(a.foodId);
      if (!f) return;
      setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === a.itemId ? { ...itemDe(f, a.g), id: i.id } : i)) }));
    }
    toast("Hecho: mira cómo cambian los números.");
  }

  function resolver(pendId: string, f: Food) {
    setDraft((d) => {
      const p = d.pend.find((x) => x.id === pendId);
      if (!p) return d;
      return { ...d, pend: d.pend.filter((x) => x.id !== pendId), items: [...d.items, itemDe(f, calcGramos(f, p.cant, datos.habituales), { texto: p.texto })] };
    });
  }
  function guardarPropio(f: Food) {
    datos.setPropios((l) => [f, ...l.filter((x) => x.id !== f.id)]);
    if (creando?.pendId) resolver(creando.pendId, f);
    else anadirAlimento(f);
    setCreando(null);
    toast("Alimento guardado en «Propios».");
  }
  function usarBase(i: Item) {
    const f = i.foodId ? catalogo.get(i.foodId) : undefined;
    if (!f) return;
    setItem(i.id, (x) => ({ ...x, por100: { kcal: f.kcal, p: f.p, c: f.c, az: f.az, fi: f.fi, gr: f.gr }, ig: f.ig, fuente: "base", aviso: undefined, conf: undefined }));
  }

  const puedeGuardar = draft.items.length > 0;
  const hc = Math.max(perfil.hcComida * 1.4, tot.c);
  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rev-t">
      <div class="sheet__scroll">
        <header class="sheet__head">
          <h2 id="rev-t">Revisa lo que has comido</h2>
          <p class="k-text muted">Ajusta las cantidades y verás cómo cambian las correcciones. Nada se guarda hasta que pulses «Guardar».</p>
          {draft.iaError ? <p class="k-callout warn">{draft.iaError}</p> : null}
          {draft.iaResumen ? <p class="k-callout"><em class="tag-ia">IA</em> {draft.iaResumen}</p> : null}
        </header>
        <div class="rev-cols">
          <div class="rev-a">
            <section class="ep-card">
              <h3 class="card-h">Lo que hay en el plato</h3>
              {draft.pend.map((p) => (
                <div class="pend" key={p.id}>
                  <p class="k-text"><span class="tag-no">no encontrado</span> «{p.texto}»</p>
                  {creando?.pendId === p.id ? (
                    <FormAlimento nombre={p.texto} onSave={guardarPropio} onCancel={() => setCreando(null)} />
                  ) : (
                    <>
                      <BuscadorAlimento lista={lista} onPick={(f) => resolver(p.id, f)} placeholder="Busca cuál es…" />
                      <div class="btn-row"><Button label="Crear este alimento" onClick={() => setCreando({ pendId: p.id, nombre: p.texto })} /><Button label="Quitarlo" onClick={() => setDraft((d) => ({ ...d, pend: d.pend.filter((x) => x.id !== p.id) }))} /></div>
                    </>
                  )}
                </div>
              ))}
              {draft.items.length === 0 && draft.pend.length === 0 ? <p class="k-text muted">Todavía no hay nada. Añade un alimento abajo.</p> : null}
              <ul class="items">
                {draft.items.map((it) => {
                  const f = it.foodId ? catalogo.get(it.foodId) : undefined;
                  const t = itemTotales(it);
                  const paso = pasoDe(it, f);
                  return (
                    <li class="item-row" key={it.id}>
                      <div class="item-row__top">
                        <div class="item-row__name">
                          <b>{it.nombre}</b>
                          <span class="chips">
                            <span class={`chip src-${it.fuente}`} title="De dónde sale el valor">{FUENTE_TXT[it.fuente] ?? it.fuente}</span>
                            {it.conf ? <span class={`chip conf-${it.conf}`}>confianza {it.conf}</span> : null}
                            <span class="chip">el azúcar sube {IG_TXT[it.ig]}</span>
                          </span>
                        </div>
                        <button type="button" class="icon-btn" aria-label={`Quitar ${it.nombre}`} onClick={() => quitar(it.id)}>×</button>
                      </div>
                      <div class="qty">
                        <button type="button" class="qty__b" aria-label="Menos" onClick={() => cambiarG(it.id, Math.max(0, it.g - paso))}>−</button>
                        <label class="qty__in"><input inputMode="decimal" aria-label={`Gramos de ${it.nombre}`} value={String(Math.round(it.g * 10) / 10).replace(".", ",")} onInput={(e) => { const v = parseFloat((e.currentTarget as HTMLInputElement).value.replace(",", ".")); cambiarG(it.id, Number.isFinite(v) ? v : 0); }} /><span>g</span></label>
                        <button type="button" class="qty__b" aria-label="Más" onClick={() => cambiarG(it.id, it.g + paso)}>+</button>
                        <span class="qty__f">
                          <button type="button" onClick={() => cambiarG(it.id, it.g / 2)}>½</button>
                          <button type="button" onClick={() => cambiarG(it.id, it.g * 1.5)}>×1,5</button>
                          <button type="button" onClick={() => cambiarG(it.id, it.g * 2)}>×2</button>
                        </span>
                      </div>
                      <small class="item-row__fig">{ktxt(t.kcal)} · {fmt(t.p)} g de proteína · {fmt(t.c)} g de hidratos{f?.rac[0] ? ` · ración: ${f.rac[0].n} (${fmt(f.rac[0].g)} g)` : ""}</small>
                      {it.aviso ? <p class="item-row__warn">{it.aviso} {it.foodId ? <button type="button" class="link-btn" onClick={() => usarBase(it)}>Usar el valor de la base</button> : null}</p> : null}
                      {it.nota ? <small class="item-row__fig">Nota: {it.nota}</small> : null}
                      {it.cambiado && it.def && it.foodId ? <small class="item-row__fig">Recordaré esta ración la próxima vez.</small> : null}
                    </li>
                  );
                })}
              </ul>
              {anadir ? (
                creando && !creando.pendId ? (
                  <FormAlimento nombre={creando.nombre} onSave={guardarPropio} onCancel={() => setCreando(null)} />
                ) : (
                  <div class="add-box">
                    <BuscadorAlimento lista={lista} onPick={(f) => { anadirAlimento(f); setAnadir(false); }} autoFocus />
                    <div class="btn-row"><Button label="Crear un alimento nuevo" onClick={() => setCreando({})} /><Button label="Cerrar" onClick={() => setAnadir(false)} /></div>
                  </div>
                )
              ) : (
                <div class="btn-row"><Button label="+ Añadir otro alimento" onClick={() => setAnadir(true)} /></div>
              )}
              <p class="k-text muted tiny">El aceite y las salsas suelen faltar: si has usado, añádelos (1 cucharada de aceite ≈ 90 kcal).</p>
            </section>
          </div>
          <div class="rev-b">
            <section class="ep-card">
              <h3 class="card-h">Esta comida</h3>
              <div class="k-metrics tight">
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.kcal)}</div><div class="k-metric__label">calorías</div></div>
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.p)} g</div><div class="k-metric__label">proteína</div></div>
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.c)} g</div><div class="k-metric__label">hidratos</div></div>
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.fi)} g</div><div class="k-metric__label">fibra</div></div>
              </div>
              <Barra etiqueta="Proteína" texto={`${fmt(tot.p)} de ~${fmt(T.p)} g`} valor={tot.p} max={Math.max(T.p * 1.3, tot.p)} marca={T.p} color={th.dataviz.categorical[0]} />
              <Barra etiqueta="Hidratos (pan, arroz, pasta, patata, fruta…)" texto={`${fmt(tot.c)} g · tope ${fmt(T.hc)} g`} valor={tot.c} max={hc} marca={T.hc} color={tot.c > T.hc * 1.04 ? th.text.warning : th.dataviz.categorical[3]} />
            </section>
            <section class="ep-card">
              <h3 class="card-h">Mi corrección</h3>
              {corr.length || draft.iaCorr.length ? (
                <ul class="corrs">
                  {corr.map((c, i) => <Corr key={`r${i}${c.texto}`} c={c} onAplicar={aplicar} />)}
                  {draft.iaCorr.map((c, i) => <Corr key={`i${i}`} c={{ ...c, origen: "ia" }} />)}
                </ul>
              ) : <p class="k-text muted">Añade algo a la comida y te digo cómo mejorarla.</p>}
            </section>
            <section class="ep-card">
              <h3 class="card-h">Detalles</h3>
              <div class="k-grid g2">
                <label class="k-field"><span class="k-field__label">Hora</span>
                  <input class="k-input" type="time" value={draft.hora} onInput={(e) => { const h = (e.currentTarget as HTMLInputElement).value; setDraft((d) => ({ ...d, hora: h, toma: d.tomaManual || !h ? d.toma : tomaPorHora(h) })); }} /></label>
                <label class="k-field"><span class="k-field__label">Fecha</span>
                  <input class="k-input" type="date" value={draft.fecha} onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; if (v) setDraft((d) => ({ ...d, fecha: v })); }} /></label>
              </div>
              <div class="k-field"><span class="k-field__label">Toma</span>
                <Segmented<Toma> options={TOMAS.map((t) => ({ value: t.id, label: t.label }))} value={draft.toma} onChange={(v) => setDraft((d) => ({ ...d, toma: v, tomaManual: true }))} /></div>
              <div class="k-grid g2">
                <Input label="Glucosa antes (mg/dL)" type="number" value={draft.glucAntes} onChange={(v) => setDraft((d) => ({ ...d, glucAntes: v }))} placeholder="opcional" />
                <Input label="Glucosa a las 2 h (mg/dL)" type="number" value={draft.glucDespues} onChange={(v) => setDraft((d) => ({ ...d, glucDespues: v }))} placeholder="opcional" />
              </div>
              <Input label="Nota" value={draft.nota} onChange={(v) => setDraft((d) => ({ ...d, nota: v }))} placeholder="cómo te has sentido, dónde comiste…" />
              <button type="button" role="switch" aria-checked={draft.fav} class="k-toggle" onClick={() => setDraft((d) => ({ ...d, fav: !d.fav, favNombre: d.favNombre || d.items.slice(0, 3).map((i) => i.nombre.toLowerCase()).join(", ") }))}>
                <span class="k-toggle__label">Guardar como comida favorita</span>
                <span class="k-toggle__track" aria-hidden="true"><span class="k-toggle__thumb" /></span>
              </button>
              {draft.fav ? <Input label="Nombre del favorito" value={draft.favNombre} onChange={(v) => setDraft((d) => ({ ...d, favNombre: v }))} /> : null}
            </section>
          </div>
        </div>
      </div>
      <footer class="sheet__foot">
        {onDelete ? <Button label="Borrar" onClick={onDelete} /> : null}
        <Button label="Cancelar" onClick={onCancel} />
        <Button label={draft.editId ? "Guardar cambios" : "Guardar"} variant="primary" disabled={!puedeGuardar} onClick={() => onSave(draft)} />
      </footer>
    </div>
  );
}
export { uid, gtxt };
