/* Botón «Compartir con Coco»: webhook → Atajo de iPhone → compartir → copiar. */
import { useRef, useState } from "preact/hooks";
import { type Paquete, compartirConCoco, compartirTexto, construirPaquete, copiar, esIOS, usarAtajo } from "./coco";
import type { Datos } from "./data";
import { Button, toast } from "./kit";
import { useSecretos } from "./store";

export function CompartirCoco({ datos, desde, hasta, periodo, extra }: { datos: Datos; desde: string; hasta: string; periodo: "dia" | "semana"; extra?: () => string[] }) {
  const [sec] = useSecretos();
  const [pk, setPk] = useState<Paquete | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const meals = () => datos.comidas.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  const crear = () => construirPaquete(desde, meals(), datos.perfil, periodo, extra?.() ?? []);

  async function enviar() {
    if (!meals().length) return toast("Todavía no hay comidas apuntadas para compartir.", true);
    const p = crear();
    setPk(p);
    const r = await compartirConCoco(p, { url: sec.cocoUrl, clave: sec.cocoClave, atajo: datos.ajustes.atajo, usarAtajo: datos.ajustes.usarAtajo });
    if (r === "webhook") toast("Enviado a Coco.");
    else if (r === "atajo") toast("Abriendo tu Atajo «" + datos.ajustes.atajo + "»…");
    else if (r === "copiado") toast("Copiado: pégalo en el chat de Coco.");
    else if (r === "cancelado") toast("No se ha podido compartir. Prueba «Ver texto».", true);
  }
  function ver() {
    if (!meals().length) return toast("Todavía no hay comidas apuntadas para compartir.", true);
    setPk(crear());
    setTimeout(() => (dlg.current?.showModal ? dlg.current.showModal() : dlg.current?.setAttribute("open", "")), 0);
  }
  return (
    <>
      <div class="btn-row">
        <Button label="Compartir con Coco" variant="primary" onClick={enviar} />
        <Button label="Ver texto" onClick={ver} />
      </div>
      <dialog ref={dlg} class="k-dialog wide" onClose={() => undefined} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <h2>Para Coco</h2>
        <textarea class="k-input preview" readOnly value={pk?.texto ?? ""} aria-label="Texto para Coco" />
        <div class="btn-row">
          <Button label="Copiar texto" variant="primary" onClick={async () => toast((await copiar(pk?.texto ?? "")) ? "Copiado: pégalo en el chat de Coco." : "No se pudo copiar.", false)} />
          <Button label="Copiar JSON" onClick={async () => toast((await copiar(JSON.stringify({ context: pk?.context, tipo: pk?.tipo, fecha: pk?.fecha, dia: pk?.dia }, null, 2))) ? "JSON copiado." : "No se pudo copiar.")} />
          {typeof navigator.share === "function" ? <Button label="Compartir…" onClick={() => pk && void compartirTexto(pk)} /> : null}
          {esIOS() ? <Button label="Usar mi Atajo" onClick={() => pk && void usarAtajo(datos.ajustes.atajo || "Enviar a Coco", pk)} /> : null}
          <Button label="Cerrar" onClick={() => dlg.current?.close()} />
        </div>
      </dialog>
    </>
  );
}
