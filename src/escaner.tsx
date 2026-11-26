/* Escáner de productos: cámara trasera con lector (nativo o ZXing en iOS), foto del código, EAN a mano y búsqueda por nombre en Open Food Facts. */
import { useEffect, useRef, useState } from "preact/hooks";
import { Button, Input } from "./kit";
import { type Camara, buscarOFF, camaraDisponible, codigoDeFoto, eanValido, iniciarCamara, limpiarEAN, productoPorEAN } from "./off";
import type { Food } from "./types";
import { fmt } from "./util";

const MSG_DENEGADA = "No me has dado permiso para usar la cámara. Puedes activarlo en Ajustes de Safari → Cámara, o usar una de las otras dos formas: hacer una foto del código o escribir los números que hay bajo las barras.";
const MSG_SIN_CAMARA = "No he podido abrir la cámara. Haz una foto del código o escribe los números que hay bajo las barras.";

export function Escaner({ onUsar, onCerrar }: { onUsar: (f: Food) => void; onCerrar: () => void }) {
  const [ean, setEan] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState<Food[]>([]);
  const [camara, setCamara] = useState(false);
  const [luz, setLuz] = useState<{ ok: boolean; on: boolean }>({ ok: false, on: false });
  const video = useRef<HTMLVideoElement>(null);
  const cam = useRef<Camara | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    if (camaraDisponible()) void abrirCamara();
    else setMsg(MSG_SIN_CAMARA);
    return () => { vivo.current = false; cam.current?.parar(); cam.current = null; };
  }, []);

  async function porEAN(code: string) {
    const c = limpiarEAN(code);
    if (!eanValido(c)) return setMsg("El código debe tener 8, 12, 13 o 14 cifras (los números que hay debajo de las barras).");
    setCargando(true); setMsg(""); setRes([]);
    try {
      const f = await productoPorEAN(c);
      if (!vivo.current) return;
      if (!f) setMsg("Ese producto no está en Open Food Facts. Puedes crearlo a mano en «Alimentos → Propios».");
      else { cerrarCamara(); onUsar(f); return; }
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
    if (!video.current) return;
    try {
      const c = await iniciarCamara(video.current, (code) => { cerrarCamara(); setEan(code); void porEAN(code); });
      if (!vivo.current) { c.parar(); return; }
      cam.current = c;
      setLuz({ ok: c.linterna, on: false });
    } catch (e) {
      setCamara(false);
      const n = (e as Error)?.name;
      setMsg(n === "NotAllowedError" || n === "SecurityError" ? MSG_DENEGADA : MSG_SIN_CAMARA);
    }
  }
  function cerrarCamara() { cam.current?.parar(); cam.current = null; setCamara(false); setLuz({ ok: false, on: false }); }
  async function alternarLuz() {
    if (!cam.current) return;
    const on = await cam.current.encender(!luz.on);
    setLuz({ ok: true, on });
  }
  async function deFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    setCargando(true); setMsg("");
    try {
      const code = await codigoDeFoto(f);
      if (code) { setEan(code); await porEAN(code); return; }
      setMsg("No he visto ningún código en la foto. Prueba de más cerca, con buena luz y con las barras rectas.");
    } catch { setMsg("No se pudo leer la foto. Escribe el código a mano."); }
    setCargando(false);
  }

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="esc-t">
      <div class="sheet__scroll narrow">
        <header class="sheet__head"><h2 id="esc-t">Escanear un producto</h2>
          <p class="k-text muted">Funciona con productos de supermercado (Hacendado, Eroski…) que estén en Open Food Facts.</p></header>
        <section class="ep-card">
          {camara ? (
            <div class="cam" aria-live="polite">
              <div class="cam__view">
                <video ref={video} muted playsInline aria-label="Cámara trasera" />
                <div class="cam__frame" aria-hidden="true"><i /></div>
                {luz.ok ? <button type="button" class={`cam__torch${luz.on ? " on" : ""}`} aria-pressed={luz.on} aria-label="Linterna" onClick={alternarLuz}>🔦</button> : null}
              </div>
              <p class="k-text muted tiny cam__hint">Pon el código dentro del marco. Se lee solo.</p>
              <div class="btn-row"><Button label="Cerrar cámara" onClick={cerrarCamara} /></div>
            </div>
          ) : (
            <div class="btn-row">
              {camaraDisponible() ? <Button label="Abrir la cámara" variant="primary" onClick={abrirCamara} /> : null}
              <Button label="Hacer foto del código" variant={camaraDisponible() ? "default" : "primary"} onClick={() => file.current?.click()} />
            </div>
          )}
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={deFoto} />
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
