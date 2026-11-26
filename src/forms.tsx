/* Piezas reutilizables: buscador de alimentos y formulario para crear/editar un alimento propio. */
import { useMemo, useState } from "preact/hooks";
import { Button, Input, Segmented } from "./kit";
import { buscar } from "./parser";
import { parseRacion, slug } from "./foods";
import type { Food, IG } from "./types";
import { fmt, uid } from "./util";

export const IG_TXT: Record<IG, string> = { bajo: "poco", medio: "algo", alto: "mucho" };
export const FUENTE_TXT: Record<string, string> = { base: "Base", off: "Open Food Facts", ia: "IA", propio: "Propio", manual: "Manual" };

export function BuscadorAlimento({ lista, onPick, placeholder, limite = 6, autoFocus }: { lista: Food[]; onPick: (f: Food) => void; placeholder?: string; limite?: number; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const res = useMemo(() => (q.trim().length >= 2 ? buscar(q, lista, limite) : []), [q, lista, limite]);
  return (
    <div class="buscador">
      <label class="k-field" style={{ marginTop: 0 }}>
        <input class="k-input" type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellcheck={false} autofocus={autoFocus}
          placeholder={placeholder ?? "Busca un alimento (atún, lentejas, pan integral…)"} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} aria-label="Buscar alimento" />
      </label>
      {q.trim().length >= 2 ? (
        res.length ? (
          <ul class="resultados">
            {res.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => { onPick(f); setQ(""); }}>
                  <span><b>{f.n}</b><small>{f.rac[0]?.n ? `${f.rac[0].n} (${fmt(f.rac[0].g)} g) · ` : ""}{fmt(f.kcal)} kcal · {fmt(f.p, 1)} g de proteína por 100 g</small></span>
                  <i aria-hidden="true">+</i>
                </button>
              </li>
            ))}
          </ul>
        ) : <p class="k-text muted">No hay nada con ese nombre. Prueba con otra palabra o crea el alimento.</p>
      ) : null}
    </div>
  );
}

const num = (s: string): number => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function FormAlimento({ inicial, nombre, onSave, onCancel }: { inicial?: Food; nombre?: string; onSave: (f: Food) => void; onCancel: () => void }) {
  const [n, setN] = useState(inicial?.n ?? nombre ?? "");
  const [kcal, setKcal] = useState(inicial ? String(inicial.kcal) : "");
  const [p, setP] = useState(inicial ? String(inicial.p) : "");
  const [c, setC] = useState(inicial ? String(inicial.c) : "");
  const [az, setAz] = useState(inicial ? String(inicial.az) : "");
  const [fi, setFi] = useState(inicial ? String(inicial.fi) : "");
  const [gr, setGr] = useState(inicial ? String(inicial.gr) : "");
  const [rac, setRac] = useState(inicial?.rac[0] ? String(Math.round(inicial.rac[0].g)) : "");
  const [ig, setIg] = useState<IG>(inicial?.ig ?? "medio");
  const [err, setErr] = useState("");
  function guardar() {
    if (!n.trim()) return setErr("Ponle un nombre.");
    const k = num(kcal);
    if (!k && !num(p) && !num(c) && !num(gr)) return setErr("Escribe al menos las calorías o los gramos de proteína, hidratos o grasa (por 100 g).");
    const ch = num(c);
    const f: Food = {
      id: inicial?.id ?? `propio-${slug(n)}-${uid().slice(-4)}`, n: n.trim(), cat: inicial?.cat ?? "propio",
      kcal: k || Math.round(4 * num(p) + 4 * ch + 9 * num(gr)), p: num(p), c: ch, az: Math.min(num(az), ch), fi: Math.min(num(fi), ch), gr: num(gr),
      ig, syn: inicial?.syn ?? [], rac: num(rac) > 0 ? [parseRacion(`1 ración:${num(rac)}`)] : inicial?.rac?.length ? inicial.rac : [parseRacion("1 ración:100")], fuente: inicial?.fuente === "off" ? "off" : "propio", ean: inicial?.ean,
    };
    onSave(f);
  }
  return (
    <div class="form-alimento">
      <Input label="Nombre" value={n} onChange={setN} placeholder="Por ejemplo: mi bizcocho" />
      <p class="k-text muted">Valores por cada 100 g (o 100 ml), como vienen en la etiqueta.</p>
      <div class="k-grid g2">
        <Input label="Calorías (kcal)" type="number" value={kcal} onChange={setKcal} />
        <Input label="Proteína (g)" type="number" value={p} onChange={setP} />
        <Input label="Hidratos (g)" type="number" value={c} onChange={setC} />
        <Input label="de los cuales azúcares (g)" type="number" value={az} onChange={setAz} />
        <Input label="Fibra (g)" type="number" value={fi} onChange={setFi} />
        <Input label="Grasa (g)" type="number" value={gr} onChange={setGr} />
      </div>
      <Input label="Ración habitual (g)" type="number" value={rac} onChange={setRac} placeholder="100" />
      <div class="k-field"><span class="k-field__label">¿Sube el azúcar?</span>
        <Segmented<IG> options={[{ value: "bajo", label: "Poco" }, { value: "medio", label: "Algo" }, { value: "alto", label: "Mucho" }]} value={ig} onChange={setIg} />
      </div>
      {err ? <p class="k-text err" role="alert">{err}</p> : null}
      <div class="btn-row"><Button label="Guardar alimento" variant="primary" onClick={guardar} /><Button label="Cancelar" onClick={onCancel} /></div>
    </div>
  );
}
