/* Del texto (o la foto) al borrador revisable: primero el parser local; la IA, si está activa, da una primera estimación. */
import { ErrorIA, analizarComida, itemsDeIA, provInfo, type Cfg } from "./ai";
import { type Datos, type Draft, draftDeTexto, draftVacio } from "./data";
import { useSecretos } from "./store";
import type { Correccion } from "./types";
import { tomaPorHora } from "./types";
import { isoDate } from "./util";

export function useIA(datos: Datos): { activa: boolean; cfg: Cfg } {
  const [sec] = useSecretos();
  const prov = datos.ajustes.proveedor;
  const clave = sec.claves[prov] ?? "";
  const modelo = datos.ajustes.modelos[prov] || provInfo(prov).defecto;
  return { activa: datos.ajustes.usarIA && !!clave.trim(), cfg: { proveedor: prov, clave, modelo } };
}

export async function crearBorrador(o: { texto: string; imagenes?: string[]; datos: Datos; ia: { activa: boolean; cfg: Cfg }; fecha: string }): Promise<Draft> {
  const { texto, datos, ia, fecha } = o;
  const imagenes = o.imagenes ?? [];
  const local = draftDeTexto(texto, fecha, datos);
  if (imagenes.length) local.origen = "foto";
  if (!ia.activa) return local;
  try {
    const hora = local.hora;
    const r = await analizarComida(ia.cfg, { perfil: datos.perfil, hoy: datos.comidas.filter((m) => m.fecha === fecha), historial: datos.comidas, toma: tomaPorHora(hora), hora }, texto, imagenes);
    const d = draftVacio(fecha, imagenes.length ? "foto" : "texto", texto);
    d.items = itemsDeIA(r, datos.lista).map((i) => ({ ...i, texto }));
    d.iaCorr = r.correcciones.map((c): Correccion => ({ tipo: c.tipo, texto: c.texto, origen: "ia" }));
    d.iaResumen = r.resumen;
    return d;
  } catch (e) {
    const msg = e instanceof ErrorIA ? e.message : "No se pudo conectar: revisa la clave.";
    local.iaError = `La IA no ha podido ayudar (${msg}) He usado el modo base: revisa las cantidades.`;
    if (!local.items.length && !local.pend.length && !texto.trim()) local.iaError += " Escribe lo que hay en el plato para que lo analice.";
    return local;
  }
}
export { isoDate };
