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
  const [verMasConsejos, setVerMasConsejos] = useState(false);
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
    toast("Alimento guardado en «Propios». ");
  }
  function usarBase(i: Item) {
    const f = i.foodId ? catalogo.get(i.foodId) : undefined;
    if (!f) return;
    setItem(i.id, (x) => ({ ...x, por100: { kcal: f.kcal, p: f.p, c: f.c, az: f.az, fi: f.fi, gr: f.gr }, ig: f.ig, fuente: "base", aviso: undefined, conf: undefined }));
  }

  const puedeGuardar = draft.items.length > 0;
  const hc = Math.max(perfil.hcComida * 1.4, tot.c);
  const visiblesCorr = verMasConsejos ? corr : corr.slice(0, 2);
  const ocultasCorrCount = Math.max(0, corr.length - 2);

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rev-t">
      <div class="sheet__scroll">
        <header class="sheet__head">
          <h2 id="rev-t">Tu comida</h2>
          {draft.iaError ? <p class="k-callout warn">{draft.iaError}</p> : null}
          {draft.iaResumen ? <p class="k-callout"><em class="tag-ia">IA</em> {draft.iaResumen}</p> : null}
        </header>
        <div class="rev-cols">
          <div class="rev-a">
            <section class="ep-card">
              <div class="k-metrics tight">
                <div class="k-metric"><div class="k-metric__value">{Math.round(tot.kcal)}</div><div class="k-metric__label">calorías</div></div>
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.p)} g</div><div class="k-metric__label">proteína</div></div>
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.c)} g</div><div class="k-metric__label">hidratos</div></div>
                <div class="k-metric"><div class="k-metric__value">{fmt(tot.fi)} g</div><div class="k-metric__label">fibra</div></div>
              </div>
            </section>

            <section class="ep-card">
              <h3 class="card-h">Alimentos</h3>
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
                {draft.items.map((it) => <ItemRow key={it.id} it={it} catalogo={catalogo} onQuitar={() => quitar(it.id)} onChangeG={(g) => cambiarG(it.id, g)} onUsarBase={() => usarBase(it)} />)}
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
                <div class="btn-row"><Button label="+ Añadir alimento" onClick={() => setAnadir(true)} /></div>
              )}
            </section>
          </div>
          <div class="rev-b">
            <section class="ep-card">
              <h3 class="card-h">Correcciones</h3>
              {visiblesCorr.length || draft.iaCorr.length ? (
                <ul class="corrs">
                  {visiblesCorr.map((c, i) => <Corr key={`r${i}${c.texto}`} c={c} onAplicar={aplicar} />)}
                  {draft.iaCorr.map((c, i) => <Corr key={`i${i}`} c={{ ...c, origen: "ia" }} />)}
                </ul>
              ) : <p class="k-text muted">Todo en orden en esta comida.</p>}
              {ocultasCorrCount > 0 ? (
                <button type="button" class="link-btn" onClick={() => setVerMasConsejos(!verMasConsejos)}>
                  {verMasConsejos ? "Ver menos consejos" : `Ver más consejos (${ocultasCorrCount})`}
                </button>
              ) : null}
            </section>

            <details class="ep-card details-plegado">
              <summary class="card-h" style={{ cursor: "pointer" }}>Más detalles</summary>
              <div class="details-body" style={{ marginTop: "10px" }}>
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
                <Input label="Nota" value={draft.nota} onChange={(v) => setDraft((d) => ({ ...d, nota: v }))} placeholder="cómo te has sentido…" />
                <button type="button" role="switch" aria-checked={draft.fav} class="k-toggle" onClick={() => setDraft((d) => ({ ...d, fav: !d.fav, favNombre: d.favNombre || d.items.slice(0, 3).map((i) => i.nombre.toLowerCase()).join(", ") }))}>
                  <span class="k-toggle__label">Guardar como favorito</span>
                  <span class="k-toggle__track" aria-hidden="true"><span class="k-toggle__thumb" /></span>
                </button>
                {draft.fav ? <Input label="Nombre del favorito" value={draft.favNombre} onChange={(v) => setDraft((d) => ({ ...d, favNombre: v }))} /> : null}
              </div>
            </details>
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

function ItemRow({ it, catalogo, onQuitar, onChangeG, onUsarBase }: { it: Item; catalogo: Map<string, Food>; onQuitar: () => void; onChangeG: (g: number) => void; onUsarBase: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const f = it.foodId ? catalogo.get(it.foodId) : undefined;
  const t = itemTotales(it);
  const paso = pasoDe(it, f);

  return (
    <li class="item-row">
      <div class="item-row__top">
        <div class="item-row__name" onClick={() => setAbierto(!abierto)} role="button" tabIndex={0} style={{ cursor: "pointer", flex: 1 }}>
          <b>{it.nombre}</b>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button type="button" class="qty__b small-qty" onClick={() => onChangeG(Math.max(0, it.g - paso))}>−</button>
          <span style={{ minWidth: "44px", textAlign: "center", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(it.g)}g</span>
          <button type="button" class="qty__b small-qty" onClick={() => onChangeG(it.g + paso)}>+</button>
          <button type="button" class="icon-btn" aria-label={`Quitar ${it.nombre}`} onClick={onQuitar}>×</button>
        </div>
      </div>
      {abierto ? (
        <div class="item-row__details" style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div class="chips">
            <span class={`chip src-${it.fuente}`}>{FUENTE_TXT[it.fuente] ?? it.fuente}</span>
            {it.conf ? <span class={`chip conf-${it.conf}`}>confianza {it.conf}</span> : null}
            <span class="chip">el azúcar sube {IG_TXT[it.ig]}</span>
          </div>
          <div class="qty">
            <button type="button" class="qty__b" onClick={() => onChangeG(Math.max(0, it.g - paso))}>−</button>
            <label class="qty__in"><input inputMode="decimal" value={String(Math.round(it.g * 10) / 10).replace(".", ",")} onInput={(e) => { const v = parseFloat((e.currentTarget as HTMLInputElement).value.replace(",", ".")); onChangeG(Number.isFinite(v) ? v : 0); }} /><span>g</span></label>
            <button type="button" class="qty__b" onClick={() => onChangeG(it.g + paso)}>+</button>
            <span class="qty__f">
              <button type="button" onClick={() => onChangeG(it.g / 2)}>½</button>
              <button type="button" onClick={() => onChangeG(it.g * 1.5)}>×1,5</button>
              <button type="button" onClick={() => onChangeG(it.g * 2)}>×2</button>
            </span>
          </div>
          <small class="item-row__fig">{ktxt(t.kcal)} · {fmt(t.p)} g proteína · {fmt(t.c)} g hidratos{f?.rac[0] ? ` · ración: ${f.rac[0].n} (${fmt(f.rac[0].g)} g)` : ""}</small>
          {it.aviso ? <p class="item-row__warn">{it.aviso} {it.foodId ? <button type="button" class="link-btn" onClick={onUsarBase}>Usar el valor de la base</button> : null}</p> : null}
          {it.nota ? <small class="item-row__fig">Nota: {it.nota}</small> : null}
        </div>
      ) : null}
    </li>
  );
}

