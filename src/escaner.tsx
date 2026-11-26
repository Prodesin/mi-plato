/* Escáner de productos: cámara (si el navegador lee códigos), foto del código o EAN a mano, y búsqueda por nombre en Open Food Facts. */
import { useEffect, useRef, useState } from "preact/hooks";
import { Button, Input } from "./kit";
import { barcodeSoportado, buscarOFF, codigoDeFoto, eanValido, iniciarCamara, limpiarEAN, productoPorEAN } from "./off";
import type { Food } from "./types";
import { fmt } from "./util";

export function Escaner({ onUsar, onCerrar }: { onUsar: (f: Food) => void; onCerrar: () => void }) {
  const [ean, setEan] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState<Food[]>([]);
  const [camara, setCamara] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const parar = useRef<(() => void) | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => () => parar.current?.(), []);

  async function porEAN(code: string) {
    const c = limpiarEAN(code);
    if (!eanValido(c)) return setMsg("El código debe tener 8, 12, 13 o 14 cifras (los números que hay debajo de las barras).");
    setCargando(true); setMsg(""); setRes([]);
    try {
      const f = await productoPorEAN(c);
      if (!f) setMsg("Ese producto no está en Open Food Facts. Puedes crearlo a mano en «Alimentos → Propios».");
      else setRes([f]);
    } catch (e) { setMsg((e as Error).message); }
    setCargando(false);
  }
  async function porNombre() {
    if (nombre.trim().length < 2) return;
    setCargando(true); setMsg(""); setRes([]);
    try {
      const r = await buscarOFF(nombre.trim());
      setRes(r);
      if (!r.length) setMsg("No he encontrado productos con ese nombre.");
    } catch (e) { setMsg((e as Error).message); }
    setCargando(false);
  }
  async function abrirCamara() {
    setMsg("");
    setCamara(true);
    await new Promise((ok) => setTimeout(ok, 30));
    try {
      parar.current = await iniciarCamara(video.current!, (code) => { parar.current?.(); parar.current = null; setCamara(false); setEan(code); void porEAN(code); });
    } catch {
      setCamara(false);
      setMsg("No he podido abrir la cámara. Haz una foto del código o escríbelo a mano.");
    }
  }
  function cerrarCamara() { parar.current?.(); parar.current = null; setCamara(false); }
  async function deFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    try {
      const code = await codigoDeFoto(f);
      if (code) { setEan(code); void porEAN(code); }
      else setMsg(barcodeSoportado() ? "No he visto ningún código en la foto. Prueba de más cerca y con buena luz." : "Este navegador no sabe leer códigos de una foto: escribe los números que hay bajo las barras.");
    } catch { setMsg("No se pudo leer la foto. Escribe el código a mano."); }
  }

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="esc-t">
      <div class="sheet__scroll narrow">
        <header class="sheet__head"><h2 id="esc-t">Escanear un producto</h2>
          <p class="k-text muted">Funciona con productos de supermercado (Hacendado, Eroski…) que estén en Open Food Facts.</p></header>
        <section class="ep-card">
          {camara ? (
            <div class="cam"><video ref={video} muted playsInline aria-label="Cámara" /><div class="btn-row"><Button label="Cerrar cámara" onClick={cerrarCamara} /></div></div>
          ) : (
            <div class="btn-row">
              {barcodeSoportado() ? <Button label="Abrir la cámara" variant="primary" onClick={abrirCamara} /> : null}
              <Button label="Hacer foto del código" variant={barcodeSoportado() ? "default" : "primary"} onClick={() => file.current?.click()} />
              <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={deFoto} />
            </div>
          )}
          {!barcodeSoportado() ? <p class="k-text muted tiny">En este móvil la cámara no lee códigos sola: escríbelo a mano (los números bajo las barras).</p> : null}
          <div class="row-in">
            <Input label="Código de barras (EAN)" type="number" value={ean} onChange={setEan} placeholder="8480000123456" />
            <Button label="Buscar" onClick={() => porEAN(ean)} disabled={cargando} />
          </div>
          <div class="row-in">
            <Input label="…o busca por nombre" value={nombre} onChange={setNombre} placeholder="yogur proteínas hacendado" />
            <Button label="Buscar" onClick={porNombre} disabled={cargando} />
          </div>
          {cargando ? <p class="k-text muted" role="status">Buscando…</p> : null}
          {msg ? <p class="k-text" role="alert">{msg}</p> : null}
          <ul class="resultados">
            {res.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => onUsar(f)}>
                  <span><b>{f.n}</b><small>{fmt(f.kcal)} kcal · {fmt(f.p, 1)} g de proteína · {fmt(f.c, 1)} g de hidratos · {fmt(f.gr, 1)} g de grasa por 100 g · {f.rac[0]?.n} ({fmt(f.rac[0]?.g ?? 100)} g)</small></span>
                  <i aria-hidden="true">+</i>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <footer class="sheet__foot"><Button label="Cerrar" onClick={() => { cerrarCamara(); onCerrar(); }} /></footer>
    </div>
  );
}
