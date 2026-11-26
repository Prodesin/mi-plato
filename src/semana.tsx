/* Pantalla «Semana»: barras por día con banda objetivo, medias, errores repetidos, lo que ha ido bien y propuestas. */
import { useMemo, useState } from "preact/hooks";
import { ErrorIA, resumenTexto, revisionConIA } from "./ai";
import type { Cfg } from "./ai";
import { BarrasDias } from "./charts";
import { revisionSemana } from "./coach";
import { CompartirCoco } from "./compartir";
import type { Datos } from "./data";
import { Button, Segmented, toast, useGrokTheme } from "./kit";
import { Corr } from "./revision";
import { DIAS_CORTOS, addDays, fechaCorta, fmt, isoDate, kcal as ktxt, u, weekStart } from "./util";
import type { Correccion } from "./types";

type Metrica = "kcal" | "p" | "c" | "fi";

export function Semana({ datos, ia, irADia }: { datos: Datos; ia: { activa: boolean; cfg: Cfg }; irADia: (f: string) => void }) {
  const th = useGrokTheme();
  const { perfil, comidas } = datos;
  const [inicio, setInicio] = useState(weekStart(isoDate()));
  const [m, setM] = useState<Metrica>("kcal");
  const [rev, setRev] = useState<{ inicio: string; resumen: string; corr: Correccion[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const sem = useMemo(() => revisionSemana(inicio, comidas, perfil), [inicio, comidas, perfil]);
  const hoy = isoDate();
  const esActual = inicio === weekStart(hoy);

  const cfg = {
    kcal: { lo: perfil.kcalMin, hi: perfil.kcalMax, f: (v: number) => u(v, "kcal"), c: th.dataviz.categorical[0], t: "Calorías por día" },
    p: { lo: perfil.protMin, hi: perfil.prot + 20, f: (v: number) => u(v, "g"), c: th.dataviz.categorical[3], t: "Proteína por día" },
    c: { lo: perfil.hcMin, hi: perfil.hcMax, f: (v: number) => u(v, "g"), c: th.dataviz.categorical[1], t: "Hidratos por día" },
    fi: { lo: perfil.fibra, hi: perfil.fibra + 10, f: (v: number) => u(v, "g"), c: th.dataviz.categorical[2], t: "Fibra por día" },
  }[m];
  const val = (d: (typeof sem.dias)[number]) => ({ kcal: d.tot.kcal, p: d.tot.p, c: d.tot.c, fi: d.tot.fi })[m];

  const extra = () => [...sem.errores.map((e) => `Error repetido: ${e.texto}`), ...sem.bien.map((b) => `Ha ido bien: ${b}`), ...sem.propuestas.map((p, i) => `Propuesta ${i + 1}: ${p}`), ...sem.glucosa];

  async function revisionIA() {
    if (!ia.activa) return toast("Activa la IA en Ajustes para pedir esta revisión.", true);
    const ms = comidas.filter((x) => x.fecha >= inicio && x.fecha <= addDays(inicio, 6));
    if (!ms.length) return toast("No hay comidas apuntadas esta semana.", true);
    setCargando(true);
    try {
      const r = await revisionConIA(ia.cfg, { perfil, hoy: [], historial: comidas, toma: "cena", hora: "20:00" }, resumenTexto(ms));
      setRev({ inicio, resumen: r.resumen, corr: r.correcciones.map((c) => ({ ...c, origen: "ia" as const })) });
    } catch (e) {
      toast((e instanceof ErrorIA ? e.message : "No se pudo conectar: revisa la clave.") + " Te dejo la revisión sin IA.", true);
    }
    setCargando(false);
  }

  return (
    <div class="cols">
      <div class="col col-a">
        <div class="item" style={{ order: 0 }}>
          <div class="daynav">
            <button type="button" class="icon-btn" aria-label="Semana anterior" onClick={() => setInicio(addDays(inicio, -7))}>‹</button>
            <div class="daynav__t"><b>{esActual ? "Esta semana" : `Semana del ${fechaCorta(inicio)}`}</b><small>{fechaCorta(inicio)} – {fechaCorta(addDays(inicio, 6))}</small></div>
            <button type="button" class="icon-btn" aria-label="Semana siguiente" disabled={esActual || inicio > hoy} onClick={() => setInicio(addDays(inicio, 7))}>›</button>
          </div>
        </div>
        <section class="ep-card" style={{ order: 1 }}>
          <h2 class="card-h">{cfg.t}</h2>
          <Segmented<Metrica> options={[{ value: "kcal", label: "Calorías" }, { value: "p", label: "Proteína" }, { value: "c", label: "Hidratos" }, { value: "fi", label: "Fibra" }]} value={m} onChange={setM} />
          <BarrasDias titulo={cfg.t} unidad="" dias={sem.dias.map((d, i) => ({ label: DIAS_CORTOS[i], valor: val(d), sel: d.fecha === hoy, sinDatos: !d.tiene }))} lo={cfg.lo} hi={cfg.hi} formato={cfg.f} color={cfg.c} />
          <div class="k-metrics">
            <div class="k-metric"><div class="k-metric__value">{sem.enObjetivo} de {sem.conDatos || 0}</div><div class="k-metric__label">días en objetivo</div><div class="k-metric__detail">calorías y proteína bien</div></div>
            <div class="k-metric"><div class="k-metric__value">{fmt(sem.medias.kcal)}</div><div class="k-metric__label">calorías de media</div></div>
            <div class="k-metric"><div class="k-metric__value">{fmt(sem.medias.p)} g</div><div class="k-metric__label">proteína de media</div></div>
            <div class="k-metric"><div class="k-metric__value">{fmt(sem.medias.c)} g</div><div class="k-metric__label">hidratos de media</div></div>
          </div>
          <div class="dias-links">{sem.dias.map((d, i) => <button type="button" key={d.fecha} class="chip-btn" disabled={!d.tiene} onClick={() => irADia(d.fecha)}>{DIAS_CORTOS[i]} {d.fecha.slice(8)}</button>)}</div>
        </section>
      </div>
      <div class="col col-b">
        {sem.conDatos === 0 ? (
          <section class="ep-card" style={{ order: 2 }}><p class="k-text">Esta semana todavía no hay comidas apuntadas. Cuando apuntes unas cuantas, aquí verás qué se repite y qué cambiar.</p></section>
        ) : (
          <>
            <section class="ep-card" style={{ order: 2 }}>
              <h2 class="card-h">Lo que se repite</h2>
              {sem.errores.length ? (
                <ul class="corrs">{sem.errores.map((e, i) => <Corr key={i} c={{ tipo: "aviso", texto: e.texto, porque: e.porque, origen: "reglas" }} />)}</ul>
              ) : <p class="k-text">No veo errores que se repitan esta semana. Buen trabajo.</p>}
            </section>
            <section class="ep-card" style={{ order: 3 }}>
              <h2 class="card-h">Lo que ha ido bien</h2>
              {sem.bien.length ? <ul class="corrs">{sem.bien.map((b, i) => <Corr key={i} c={{ tipo: "ok", texto: b, origen: "reglas" }} />)}</ul> : <p class="k-text muted">Apunta unos días más y te cuento qué va bien.</p>}
            </section>
            <section class="ep-card" style={{ order: 4 }}>
              <h2 class="card-h">3 cambios para la semana que viene</h2>
              <ol class="k-steps">{sem.propuestas.map((p, i) => <li key={i}><span class="k-steps__n" aria-hidden="true">{i + 1}</span><span class="k-steps__body"><span class="k-steps__title">{p}</span></span></li>)}</ol>
            </section>
            {sem.glucosa.length ? (
              <section class="ep-card" style={{ order: 5 }}>
                <h2 class="card-h">Glucosa y comidas</h2>
                {sem.glucosa.map((g, i) => <p class="k-text" key={i}>{g}</p>)}
              </section>
            ) : null}
            <section class="ep-card" style={{ order: 6 }}>
              <h2 class="card-h">Más ayuda</h2>
              {rev && rev.inicio === inicio ? <div class="rev-ia"><p class="k-text">{rev.resumen}</p><ul class="corrs">{rev.corr.map((c, i) => <Corr key={i} c={c} />)}</ul></div> : null}
              <div class="btn-row"><Button label={cargando ? "Pensando…" : "Revisión con IA"} disabled={cargando} onClick={revisionIA} /></div>
              <CompartirCoco datos={datos} desde={inicio} hasta={addDays(inicio, 6)} periodo="semana" extra={extra} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
export { ktxt };
