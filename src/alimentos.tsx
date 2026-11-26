/* Pantalla «Alimentos»: buscar en la base, comidas guardadas, alimentos propios y escanear productos. */
import { useMemo, useState } from "preact/hooks";
import { type Datos, type Draft, draftVacio, itemDe, itemsDeFavorito } from "./data";
import { BuscadorAlimento, FUENTE_TXT, FormAlimento, IG_TXT } from "./forms";
import { Button, ConfirmDialog, Segmented, toast } from "./kit";
import { FOODS } from "./foods";
import type { Food } from "./types";
import { tomaLabel, sumar } from "./types";
import { fmt, kcal as ktxt } from "./util";

type Tab = "buscar" | "guardadas" | "propios";

export function Alimentos({ datos, abrir, abrirEscaner, fecha }: { datos: Datos; abrir: (d: Draft) => void; abrirEscaner: () => void; fecha: string }) {
  const [tab, setTab] = useState<Tab>("buscar");
  const [sel, setSel] = useState<Food | null>(null);
  const [editando, setEditando] = useState<Food | "nuevo" | null>(null);
  const [borrar, setBorrar] = useState<Food | null>(null);
  const [borrarFav, setBorrarFav] = useState<string | null>(null);
  const { propios, setPropios, favs, setFavs, lista } = datos;

  const apuntar = (f: Food) => {
    const d = draftVacio(fecha, "manual");
    d.items = [itemDe(f, datos.habituales[f.id] ?? f.rac[0]?.g ?? 100)];
    abrir(d);
  };
  const populares = useMemo(() => ["huevo", "atun-al-natural", "pechuga-de-pollo-a-la-plancha", "yogur-de-proteinas", "lentejas-cocidas", "pan-integral", "queso-fresco-batido-0", "merluza-a-la-plancha"].map((id) => datos.catalogo.get(id)).filter(Boolean) as Food[], [datos.catalogo]);

  return (
    <div class="cols alim">
      <div class="col col-a">
        <div class="item" style={{ order: 0 }}>
          <Segmented<Tab> options={[{ value: "buscar", label: "Buscar" }, { value: "guardadas", label: "Guardadas" }, { value: "propios", label: "Propios" }]} value={tab} onChange={(t) => { setTab(t); setEditando(null); }} />
        </div>
        {tab === "buscar" ? (
          <section class="ep-card" style={{ order: 1 }}>
            <h2 class="card-h">Buscar en la base</h2>
            <BuscadorAlimento lista={lista} onPick={setSel} limite={20} />
            <p class="k-text muted tiny">{FOODS.length} alimentos con raciones de aquí (y los tuyos). ¿No está? Escanéalo o créalo en «Propios».</p>
            <h3 class="card-h sub">Los más típicos</h3>
            <div class="chips-row">{populares.map((f) => <button type="button" class="chip-btn" key={f.id} onClick={() => setSel(f)}>{f.n.toLowerCase()}</button>)}</div>
            <div class="btn-row"><Button label="Escanear un producto" variant="primary" onClick={abrirEscaner} /></div>
          </section>
        ) : null}
        {tab === "guardadas" ? (
          <section class="ep-card" style={{ order: 1 }}>
            <h2 class="card-h">Comidas guardadas</h2>
            {favs.length === 0 ? <p class="k-text muted">Aún no tienes ninguna. Al revisar una comida, activa «Guardar como comida favorita».</p> : (
              <ul class="favs">
                {favs.map((f) => {
                  const t = sumar(f.items);
                  return (
                    <li key={f.id}>
                      <div><b>{f.nombre}</b>{f.toma ? <span class="muted"> · {tomaLabel(f.toma)}</span> : null}<small class="corr__fig">{f.items.map((i) => `${i.nombre.toLowerCase()} ${fmt(i.g)} g`).join(", ")} — {ktxt(t.kcal)} · {fmt(t.p)} g de proteína</small></div>
                      <div class="btn-row"><Button label="Apuntar" variant="primary" onClick={() => { const d = draftVacio(fecha, "favorito"); d.items = itemsDeFavorito(f); if (f.toma) { d.toma = f.toma; d.tomaManual = true; } abrir(d); }} /><Button label="Borrar" onClick={() => setBorrarFav(f.id)} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
        {tab === "propios" ? (
          <section class="ep-card" style={{ order: 1 }}>
            <h2 class="card-h">Mis alimentos</h2>
            {editando ? (
              <FormAlimento inicial={editando === "nuevo" ? undefined : editando} onCancel={() => setEditando(null)} onSave={(f) => { setPropios((l) => [f, ...l.filter((x) => x.id !== f.id)]); setEditando(null); setSel(f); toast("Alimento guardado."); }} />
            ) : (
              <>
                {propios.length === 0 ? <p class="k-text muted">Aquí guardas lo que no está en la base: una receta de casa, un producto raro… También se guardan los productos que escaneas.</p> : (
                  <ul class="resultados">{propios.map((f) => <li key={f.id}><button type="button" onClick={() => setSel(f)}><span><b>{f.n}</b><small>{FUENTE_TXT[f.fuente]} · {fmt(f.kcal)} kcal · {fmt(f.p, 1)} g de proteína por 100 g</small></span><i aria-hidden="true">›</i></button></li>)}</ul>
                )}
                <div class="btn-row"><Button label="Crear alimento" variant="primary" onClick={() => setEditando("nuevo")} /><Button label="Escanear un producto" onClick={abrirEscaner} /></div>
              </>
            )}
          </section>
        ) : null}
      </div>
      <div class="col col-b">
        {sel ? (
          <section class="ep-card detalle" style={{ order: 2 }} aria-live="polite">
            <h2 class="card-h">{sel.n}</h2>
            <p class="k-text muted">{FUENTE_TXT[sel.fuente]} · el azúcar te sube {IG_TXT[sel.ig]}</p>
            <div class="k-metrics">
              <div class="k-metric"><div class="k-metric__value">{fmt(sel.kcal)}</div><div class="k-metric__label">calorías</div><div class="k-metric__detail">por 100 g</div></div>
              <div class="k-metric"><div class="k-metric__value">{fmt(sel.p, 1)} g</div><div class="k-metric__label">proteína</div></div>
              <div class="k-metric"><div class="k-metric__value">{fmt(sel.c, 1)} g</div><div class="k-metric__label">hidratos</div><div class="k-metric__detail">{fmt(sel.az, 1)} g de azúcares</div></div>
              <div class="k-metric"><div class="k-metric__value">{fmt(sel.fi, 1)} g</div><div class="k-metric__label">fibra</div></div>
              <div class="k-metric"><div class="k-metric__value">{fmt(sel.gr, 1)} g</div><div class="k-metric__label">grasa</div></div>
            </div>
            {sel.rac.length ? <><h3 class="card-h sub">Raciones</h3><ul class="raciones">{sel.rac.map((r) => <li key={r.n}>{r.n} <span class="muted">({fmt(r.g)} g · {fmt((sel.kcal * r.g) / 100)} kcal · {fmt((sel.p * r.g) / 100, 1)} g de proteína)</span></li>)}</ul></> : null}
            <div class="btn-row">
              <Button label="Apuntar esto" variant="primary" onClick={() => apuntar(sel)} />
              {sel.fuente !== "base" ? <Button label="Editar" onClick={() => { setTab("propios"); setEditando(sel); }} /> : null}
              {sel.fuente !== "base" ? <Button label="Borrar" onClick={() => setBorrar(sel)} /> : null}
            </div>
          </section>
        ) : (
          <section class="ep-card" style={{ order: 2 }}><p class="k-text muted">Elige un alimento para ver sus números y sus raciones.</p></section>
        )}
      </div>
      <ConfirmDialog open={!!borrar} title="¿Borrar este alimento?" body={<p>«{borrar?.n}» desaparecerá de tus alimentos propios. Las comidas ya apuntadas no cambian.</p>} confirmLabel="Borrar" danger onCancel={() => setBorrar(null)}
        onConfirm={() => { if (borrar) { setPropios((l) => l.filter((x) => x.id !== borrar.id)); setSel(null); } setBorrar(null); }} />
      <ConfirmDialog open={!!borrarFav} title="¿Borrar esta comida guardada?" body={<p>Se quitará de tus favoritos.</p>} confirmLabel="Borrar" danger onCancel={() => setBorrarFav(null)}
        onConfirm={() => { setFavs((l) => l.filter((x) => x.id !== borrarFav)); setBorrarFav(null); }} />
    </div>
  );
}
