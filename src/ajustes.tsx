/* Pantalla «Más»: perfil y objetivos, inteligencia artificial, Coco, copia de seguridad, enlaces y privacidad. */
import { useState } from "preact/hooks";
import { ErrorIA, GEMINI_MODELOS, PROVEEDORES, cargarModelos, probarConexion, provInfo } from "./ai";
import { BackupPanel, Block, LinksPanel, PrivacyPanel } from "./backup";
import type { Datos } from "./data";
import { Button, Input, Segmented, Select, Text, Toggle, toast } from "./kit";
import { useSecretos } from "./store";
import type { Perfil, Proveedor } from "./types";
import { PERFIL_JORGE } from "./types";

function Num({ label, k, perfil, set, hint }: { label: string; k: keyof Perfil; perfil: Perfil; set: (p: Perfil) => void; hint?: string }) {
  return (
    <label class="k-field">
      <span class="k-field__label">{label}</span>
      <input class="k-input" inputMode="decimal" autoComplete="off" value={String(perfil[k]).replace(".", ",")} onInput={(e) => { const v = parseFloat((e.currentTarget as HTMLInputElement).value.replace(",", ".")); if (Number.isFinite(v) && v >= 0) set({ ...perfil, [k]: v }); }} />
      {hint ? <small class="muted">{hint}</small> : null}
    </label>
  );
}

export function Ajustes({ datos }: { datos: Datos }) {
  const { perfil, setPerfil, ajustes, setAjustes } = datos;
  const [sec, setSec] = useSecretos();
  const [modelos, setModelos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState("");
  const [ver, setVer] = useState(false);
  const [verG, setVerG] = useState(false);
  const [estadoG, setEstadoG] = useState<{ ok: boolean; txt: string } | null>(null);
  const prov = provInfo(ajustes.proveedor);
  const clave = sec.claves[ajustes.proveedor] ?? "";
  const claveG = sec.claves.gemini ?? "";
  const modeloG = ajustes.modelos.gemini && GEMINI_MODELOS.some((m) => m.id === ajustes.modelos.gemini) ? ajustes.modelos.gemini : provInfo("gemini").defecto;
  const otro: Proveedor = ajustes.proveedor === "gemini" ? "anthropic" : ajustes.proveedor;
  const provO = provInfo(otro);
  const claveO = sec.claves[otro] ?? "";
  const modeloO = ajustes.modelos[otro] ?? "";
  const puedePegar = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  function ponerClaveG(v: string) {
    const k = v.trim();
    setSec({ ...sec, claves: { ...sec.claves, gemini: k } });
    setEstadoG(null);
    if (k) setAjustes((a) => ({ ...a, proveedor: "gemini", usarIA: true })); // al pegar la clave, queda lista para usar
  }
  async function pegar() {
    try { const t = await navigator.clipboard.readText(); if (t.trim()) ponerClaveG(t); else toast("No hay nada que pegar.", true); }
    catch { toast("No he podido leer el portapapeles: pega la clave en el campo.", true); }
  }
  async function probarG() {
    if (!claveG.trim()) { setEstadoG({ ok: false, txt: "Pega primero tu clave de Gemini." }); return; }
    setOcupado("probarG"); setEstadoG(null);
    try {
      await probarConexion({ proveedor: "gemini", clave: claveG, modelo: modeloG });
      setEstadoG({ ok: true, txt: "Funciona ✓" });
    } catch (e) { setEstadoG({ ok: false, txt: e instanceof ErrorIA ? e.message : "No se pudo conectar: revisa la clave." }); }
    setOcupado("");
  }
  async function cargar() {
    setOcupado("modelos");
    try {
      const l = await cargarModelos({ proveedor: otro, clave: claveO });
      setModelos(l);
      toast(l.length ? `${l.length} modelos cargados.` : "No ha devuelto modelos.");
    } catch (e) { toast(e instanceof ErrorIA ? e.message : "No se pudo conectar: revisa la clave.", true); }
    setOcupado("");
  }
  async function probar() {
    setOcupado("probar");
    try {
      await probarConexion({ proveedor: otro, clave: claveO, modelo: modeloO || provO.defecto });
      toast("Funciona ✓");
    } catch (e) { toast(e instanceof ErrorIA ? e.message : "No se pudo conectar: revisa la clave.", true); }
    setOcupado("");
  }

  return (
    <div class="cols">
      <div class="col col-a">
        <div style={{ order: 0 }}>
          <Block heading="Tú y tus objetivos">
            <Text>Todo esto se puede cambiar. Con estos números te corrijo las comidas.</Text>
            <Input label="Nombre" value={perfil.nombre} onChange={(v) => setPerfil({ ...perfil, nombre: v })} />
            <div class="k-grid g2">
              <Num label="Altura (cm)" k="altura" perfil={perfil} set={setPerfil} />
              <Num label="Peso (kg)" k="peso" perfil={perfil} set={setPerfil} />
              <Num label="Calorías al día" k="kcal" perfil={perfil} set={setPerfil} />
              <Num label="Proteína al día (g)" k="prot" perfil={perfil} set={setPerfil} />
              <Num label="Calorías mínimas" k="kcalMin" perfil={perfil} set={setPerfil} />
              <Num label="Calorías máximas" k="kcalMax" perfil={perfil} set={setPerfil} />
              <Num label="Proteína mínima (g)" k="protMin" perfil={perfil} set={setPerfil} />
              <Num label="Fibra mínima (g)" k="fibra" perfil={perfil} set={setPerfil} />
              <Num label="Hidratos mínimos (g)" k="hcMin" perfil={perfil} set={setPerfil} />
              <Num label="Hidratos máximos (g)" k="hcMax" perfil={perfil} set={setPerfil} />
              <Num label="Hidratos por comida (g)" k="hcComida" perfil={perfil} set={setPerfil} hint="en comida y cena: pan, arroz, pasta, patata, fruta…" />
              <Num label="Grasa mínima (g)" k="grMin" perfil={perfil} set={setPerfil} />
              <Num label="Grasa máxima (g)" k="grMax" perfil={perfil} set={setPerfil} />
            </div>
            <div class="btn-row"><Button label="Volver a los valores de Jorge" onClick={() => { setPerfil(PERFIL_JORGE); toast("Valores restaurados."); }} /></div>
          </Block>
        </div>
        <div style={{ order: 1 }}>
          <Block heading="Coco (tu asistente)">
            <Text>Desde «Hoy» y «Semana» puedes mandarle a Coco tus comidas. Lo normal es compartir o copiar el texto; lo de abajo es opcional.</Text>
            <Input label="URL del webhook de Coco (opcional)" value={sec.cocoUrl} onChange={(v) => setSec({ ...sec, cocoUrl: v.trim() })} placeholder="https://…" />
            <label class="k-field"><span class="k-field__label">Clave del webhook (opcional)</span>
              <input class="k-input" type="password" autoComplete="off" autoCapitalize="off" spellcheck={false} value={sec.cocoClave} onInput={(e) => setSec({ ...sec, cocoClave: (e.currentTarget as HTMLInputElement).value.trim() })} /></label>
            <Text>Desde el navegador el webhook puede fallar por una limitación de seguridad (CORS). Si falla, no pasa nada: se usa el Atajo o se comparte el texto.</Text>
            <Toggle label="Tengo creado el Atajo de iPhone" value={ajustes.usarAtajo} onChange={(v) => setAjustes((a) => ({ ...a, usarAtajo: v }))} />
            <Input label="Nombre del Atajo" value={ajustes.atajo} onChange={(v) => setAjustes((a) => ({ ...a, atajo: v }))} placeholder="Enviar a Coco" />
            <details class="ayuda"><summary>Cómo crear el Atajo</summary>
              <ol class="k-steps">
                <li><span class="k-steps__n">1</span><span class="k-steps__body"><span class="k-steps__title">En la app Atajos, crea uno nuevo con el nombre «{ajustes.atajo || "Enviar a Coco"}».</span></span></li>
                <li><span class="k-steps__n">2</span><span class="k-steps__body"><span class="k-steps__title">Añade la acción «Obtener contenido de URL» con la URL del webhook y método POST.</span></span></li>
                <li><span class="k-steps__n">3</span><span class="k-steps__body"><span class="k-steps__title">Cabeceras: Authorization = Bearer tu clave; Content-Type = application/json.</span></span></li>
                <li><span class="k-steps__n">4</span><span class="k-steps__body"><span class="k-steps__title">Cuerpo de la solicitud: Archivo → elige «Portapapeles».</span></span></li>
              </ol>
              <Text>Los Atajos no tienen CORS, por eso funcionan. Mi plato copia el contenido y abre el Atajo.</Text>
            </details>
          </Block>
        </div>
      </div>
      <div class="col col-b">
        <div style={{ order: 2 }}>
          <Block heading="Inteligencia artificial">
            <Text>Haz una foto al plato y Gemini te apunta lo que hay; tú solo lo repasas antes de guardar. Es opcional: sin esto la app ya funciona.</Text>
            <section class="ia-gemini" aria-label="Gemini">
              <div class="ia-gemini__head"><b>Gemini (Google)</b><span class="k-status k-status--accent">gratis</span></div>
              <label class="k-field"><span class="k-field__label">Clave de Gemini</span>
                <span class="row-in tight"><input class="k-input" aria-label="Clave de Gemini" type={verG ? "text" : "password"} autoComplete="off" autoCapitalize="off" spellcheck={false} value={claveG} placeholder="pega aquí tu clave" onInput={(e) => ponerClaveG((e.currentTarget as HTMLInputElement).value)} />
                  <button type="button" class="k-btn" onClick={() => setVerG((v) => !v)}>{verG ? "Ocultar" : "Mostrar"}</button>
                  {puedePegar ? <button type="button" class="k-btn" onClick={pegar}>Pegar</button> : null}</span></label>
              <p class="k-text"><a class="ia-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Consigue tu clave gratis ›</a></p>
              <div class="k-field"><span class="k-field__label">Modelo</span>
                <Segmented<string> options={GEMINI_MODELOS.map((m) => ({ value: m.id, label: m.label.split(" · ")[0] }))} value={modeloG} onChange={(v) => setAjustes((a) => ({ ...a, modelos: { ...a.modelos, gemini: v === provInfo("gemini").defecto ? "" : v } }))} />
                <small class="muted">{GEMINI_MODELOS.find((m) => m.id === modeloG)?.label.split(" · ")[1] ?? ""}</small></div>
              <div class="btn-row"><Button label={ocupado === "probarG" ? "Probando…" : "Probar"} variant="primary" disabled={!!ocupado} onClick={probarG} /></div>
              {estadoG ? <p class={`ia-estado ${estadoG.ok ? "ok" : "mal"}`} role="status">{estadoG.txt}</p> : null}
              <p class="k-text muted tiny">La clave se guarda solo en este iPhone; no se envía a nadie más que a Google. En el nivel gratuito Google puede usar lo que envíes para mejorar sus productos.</p>
            </section>
            <Toggle label="Usar la IA al analizar" value={ajustes.usarIA} onChange={(v) => setAjustes((a) => ({ ...a, usarIA: v }))} />
            <p class="k-text muted tiny">En uso: {ajustes.usarIA && clave.trim() ? prov.nombre.split(" — ")[0] : "ninguna (modo base)"}.</p>
            <details class="ayuda"><summary>Otros proveedores</summary>
              <Select<Proveedor> label="Proveedor" options={PROVEEDORES.filter((p) => p.id !== "gemini").map((p) => ({ value: p.id, label: p.nombre }))} value={otro} onChange={(v) => { setAjustes((a) => ({ ...a, proveedor: v, usarIA: true })); setModelos([]); }} />
              <p class="k-text muted tiny">{provO.nota} Clave: <a href={provO.claveUrl} target="_blank" rel="noopener">{provO.claveUrl.replace("https://", "")}</a></p>
              <label class="k-field"><span class="k-field__label">Clave de API</span>
                <span class="row-in tight"><input class="k-input" type={ver ? "text" : "password"} autoComplete="off" autoCapitalize="off" spellcheck={false} value={claveO} placeholder="pega aquí tu clave" onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value.trim(); setSec({ ...sec, claves: { ...sec.claves, [otro]: v } }); if (v) setAjustes((a) => ({ ...a, proveedor: otro, usarIA: true })); }} />
                  <button type="button" class="k-btn" onClick={() => setVer((v) => !v)}>{ver ? "Ocultar" : "Ver"}</button></span></label>
              <label class="k-field"><span class="k-field__label">Modelo</span>
                <input class="k-input" list="modelos-ia" autoComplete="off" autoCapitalize="off" spellcheck={false} value={modeloO} placeholder={provO.defecto} onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value.trim(); setAjustes((a) => ({ ...a, modelos: { ...a.modelos, [otro]: v } })); }} />
                <datalist id="modelos-ia">{modelos.map((m) => <option value={m} key={m} />)}</datalist>
                <small class="muted">Si lo dejas vacío uso {provO.defecto}.</small></label>
              <div class="btn-row"><Button label={ocupado === "modelos" ? "Cargando…" : "Cargar modelos"} disabled={!!ocupado} onClick={cargar} /><Button label={ocupado === "probar" ? "Probando…" : "Probar conexión"} disabled={!!ocupado} onClick={probar} /></div>
              <Text>Coste aproximado: {provO.coste}.</Text>
              <div class="notice"><Text><b>Privacidad:</b> el texto (y la foto, si haces una) de cada comida se envía al proveedor elegido con tu clave. La clave se queda solo en este dispositivo y no va en la copia de seguridad salvo que lo marques.</Text></div>
            </details>
          </Block>
        </div>
        <div style={{ order: 3 }}><BackupPanel /></div>
        <div style={{ order: 4 }}><LinksPanel /></div>
        <div style={{ order: 5 }}><PrivacyPanel /></div>
      </div>
    </div>
  );
}
