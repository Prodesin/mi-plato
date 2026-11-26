# Mi plato

PWA para iPhone que **te corrige lo que comes**. No te da menús ni dietas: le cuentas lo que estás comiendo (o vas a comer) y te propone **cambios pequeños y concretos** con cosas normales de casa y del súper (Mercadona, Eroski): «Añade una lata de atún», «Con medio plato de arroz vas bien», «Cambia el zumo por la naranja entera», cada uno con su porqué en una frase.

Publicada en <https://prodesin.github.io/mi-plato/>. Apps hermanas: [Mi entrenador](https://prodesin.github.io/mi-entrenador/), [Mi menú](https://prodesin.github.io/mi-menu/), [Mi tensión](https://prodesin.github.io/mi-tension/).

> Orientativo: no sustituye a tu médico ni a tu endocrino. Si usas insulina o sulfonilureas, consulta antes de cambiar hidratos.

## Funciones

- **Hoy**: anillos de calorías y proteína, barras de hidratos y fibra, «Te quedan 600 kcal y 40 g de proteína para la cena», la caja **«¿Qué estás comiendo?»** (texto, dictado, foto, código de barras), atajos con lo de siempre / favoritos / repetir comidas de otros días, **«Qué comer ahora»** (2-3 opciones sencillas con ingredientes básicos, priorizando lo que ya sueles comer) y las comidas del día con sus correcciones.
- **Revisión editable** antes de guardar: cada alimento con sus gramos, `−`/`+`, `½`, `×1,5`, `×2`; la fuente de cada valor (Base / Open Food Facts / IA / Propio); las correcciones se recalculan en vivo y muchas tienen un botón «Hacerlo». Si corriges la ración de un alimento, la app la recuerda como tu ración habitual. Toma automática por hora (antes de 11:30 desayuno, 16:30 comida, 20:00 merienda, luego cena), glucosa (antes / 2 h después) y nota opcionales, y «guardar como favorito».
- **Semana**: barras por día con banda de objetivo (calorías, proteína, hidratos, fibra), días en objetivo, medias, errores que se repiten («Desayunos flojos de proteína: 4 de 5…», «3 de 5 cenas con demasiados hidratos», «fines de semana +400 kcal», «poca fibra»…), lo que ha ido bien, 3 cambios para la semana siguiente y, si hay datos, relación entre comidas y glucosas altas. Se puede navegar a semanas anteriores.
- **Alimentos**: buscador sobre ~300 alimentos con raciones españolas (más los tuyos), comidas guardadas, alimentos propios (crear/editar) y escáner de productos.
- **Más**: perfil y objetivos (precargados con los de Jorge, editables), inteligencia artificial opcional, Coco, copia de seguridad, enlaces y privacidad.

Todo gratis, sin cuentas ni anuncios. Los mensajes usan lenguaje llano: las cifras van como apoyo, y el efecto sobre el azúcar se dice «sube poco / algo / mucho».

## Instalación en el iPhone

1. Abre <https://prodesin.github.io/mi-plato/> en **Safari**.
2. Toca **Compartir** → **Añadir a pantalla de inicio**.

Funciona sin conexión (salvo IA, Open Food Facts y Coco, que necesitan internet). Se actualiza sola al abrirla.

## Modo base e IA

**Modo base (sin IA)** — funciona por sí solo:
- `src/foods.ts`: ~300 alimentos españoles por 100 g (calorías, proteína, hidratos, azúcares, fibra, grasa), cuánto sube el azúcar y raciones con nombre («1 lata» 52 g, «1 plato» de lentejas 300 g…).
- `src/parser.ts`: entiende texto libre («dos huevos, una tostada de pan integral y café con leche», «media ración de arroz con pollo», «200 g de pechuga», «un par de…», «plato grande»…). Lo que no reconoce queda marcado «no encontrado», con buscador y opción de crearlo.
- `src/coach.ts`: motor de reglas que da máximo 4 correcciones por comida (proteína que falta, demasiados hidratos, bebidas con azúcar, cambios sencillos, verdura, aceite olvidado, paseo tras comer…), el resumen del día, «qué comer ahora» y la revisión semanal.

**Con IA (opcional)**: en *Más → Inteligencia artificial* activa «Usar IA», elige proveedor y pega **tu** clave de API. La IA solo da una *primera estimación* (permite fotos); siempre pasas por la revisión editable y las correcciones de reglas se muestran igualmente (las de la IA van marcadas «IA»). Si la IA falla o responde algo raro, la app avisa con amabilidad y usa el modo base sin perder lo escrito.

| Proveedor | Clave | Modelo por defecto | Coste aproximado por análisis |
|---|---|---|---|
| **Claude (Anthropic) — recomendado** | [console.anthropic.com](https://console.anthropic.com/settings/keys) (la suscripción de Claude/Claude Code **no** sirve) | `claude-haiku-5-5` | 0,2–0,5 céntimos con foto |
| **Gemini (Google) — tiene nivel gratuito** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-2.5-flash` | gratis dentro del límite diario |
| xAI (Grok) | [console.x.ai](https://console.x.ai) | `grok-4.3` | 0,3–1 céntimo |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | `gpt-5-mini` | 0,1–0,4 céntimos |

El modelo es editable y hay un botón «Cargar modelos» y otro «Probar conexión». Las llamadas van directamente del navegador al proveedor.

**Privacidad de la IA**: el texto (y la foto, reducida a ~1024 px) de cada comida se envía al proveedor elegido, con tu clave. La clave se guarda **solo en este dispositivo** (`localStorage`, clave `mi-plato:secretos`), nunca en el repositorio y no se incluye en la copia de seguridad salvo que marques la casilla.

## Compartir con Coco

En *Hoy* y *Semana*, el botón **Compartir con Coco** genera un texto legible (fecha, comidas con alimentos/gramos/macros, totales frente a objetivos, correcciones, glucosas y notas) y un JSON. Intenta, por orden:

1. **Webhook** (si en *Más → Coco* has puesto URL y clave): `POST` con `Authorization: Bearer <clave>` y cuerpo `{"context":"Revisión de comidas de Jorge del AAAA-MM-DD: …","tipo":"mi-plato","fecha":"AAAA-MM-DD","dia":{…}}`. Desde un navegador es probable que falle por CORS (el servidor no devuelve `Access-Control-Allow-Origin`); si falla, pasa al siguiente sin avisar.
2. **Atajo de iPhone** (si marcas «Tengo creado el Atajo», nombre por defecto «Enviar a Coco»): copia el JSON al portapapeles y abre `shortcuts://run-shortcut?name=…&input=clipboard`.
3. **Compartir** (Web Share API) para mandarlo al chat de Coco, o **copiar** al portapapeles («Copiado: pégalo en el chat de Coco»).

«Ver texto» muestra el contenido y deja copiar el texto o el JSON a mano.

### Crear el Atajo «Enviar a Coco» (paso a paso)

Los Atajos no tienen CORS, por eso funcionan donde el navegador no.

1. App **Atajos** → **+** → nombre **Enviar a Coco**.
2. Acción **Obtener contenido de URL**: URL = la del webhook; **Método** POST.
3. **Cabeceras**: `Authorization` = `Bearer tu-clave`; `Content-Type` = `application/json`.
4. **Cuerpo de la solicitud**: *Archivo* → variable **Portapapeles**.
5. En Mi plato: *Más → Coco → Tengo creado el Atajo* (y revisa el nombre).

## Escáner de productos

Con cámara si el navegador tiene `BarcodeDetector` (Chrome/Android). En iOS Safari no existe: haz una foto del código (se intenta leer) o **escribe el EAN** (los números bajo las barras). Se consulta `https://world.openfoodfacts.org/api/v2/product/{ean}.json` (tiene productos Hacendado y Eroski) y se crea el alimento con su nutrición por 100 g y su ración. También se puede buscar por nombre (España). Los productos usados quedan en *Alimentos → Propios*.

## Copia de seguridad

*Más → Copia de seguridad*: **Exportar** un JSON con fecha (`mi-plato-AAAA-MM-DD.json`), **Importar** con validación y confirmación, y **Borrar mis datos**. Las claves (IA y Coco) quedan fuera salvo que marques «Incluir mis claves».

## Privacidad

Todo se guarda en el dispositivo (`localStorage`: `mi-plato:v1` con versión de esquema, y `mi-plato:secretos` aparte). No hay servidor, cuentas, anuncios ni analítica. La base de alimentos es pública (está en este repositorio). Solo salen peticiones a Open Food Facts, al proveedor de IA elegido y al webhook de Coco si los usas.

## Estructura

```
index.html, styles.css, manifest.webmanifest, sw.js, icon-*.png, apple-touch-icon.png
build.mjs             esbuild: src/main.tsx → app.js (sin dependencias en ejecución)
src/
  foods.ts            base de alimentos + raciones
  parser.ts           texto libre → alimentos y gramos
  coach.ts            correcciones, día, qué comer ahora, semana
  ai.ts               proveedores de IA, prompt, validación del esquema
  off.ts              Open Food Facts y código de barras
  coco.ts             texto/JSON para Coco, webhook, Atajo, compartir
  store.ts            localStorage (datos y secretos)
  data.ts, analizar.ts  estado y flujo texto/foto → borrador
  app.tsx, hoy.tsx, semana.tsx, alimentos.tsx, ajustes.tsx, revision.tsx, escaner.tsx, compartir.tsx, backup.tsx, forms.tsx, charts.tsx, kit.tsx
tools/
  check-foods.mjs     coherencia 4·P + 4·HC + 9·G ≈ kcal (±15 %), ids, raciones
  check-parser.mjs    35 frases reales
  check-coach.mjs     correcciones concretas, sin jerga, con porqué
  check-ai.mjs        formato de cada proveedor, validación y errores amables
  check-ui.py         Chrome headless: tamaños del Duo y iPhone, claro/oscuro, sin desbordes ni errores, flujo funcional
  make_icons.py       genera los iconos (Python + PIL)
```

## Compilar y publicar

```sh
npm install
npm run build      # genera app.js
npx tsc --noEmit   # comprobar tipos
npm test           # pruebas de alimentos, parser, coach e IA
```

Para probar en local: `python3 -m http.server 8782` y abre `http://localhost:8782/`. Con `/workspace/pwenv/bin/python tools/check-ui.py` se hacen las comprobaciones en navegador y las capturas.

**Al publicar una versión nueva, sube `CACHE_VERSION` en `sw.js`** (si no, el iPhone seguirá sirviendo la versión en caché). La app comprueba si hay versión nueva al abrirse y recarga sola cuando no estás escribiendo ni revisando una comida; el borrador se guarda, así que no se pierde nada.

## Layout (iPhone Duo e iPhone)

Rail vertical a la **derecha** (a la izquierda si la zona segura grande queda a ese lado). Exterior (< 600 px): una columna compacta. Interior (≥ 600 px): ancho completo y dos columnas (Hoy: anillos, caja y «qué comer» a un lado; comidas con correcciones al otro). Al plegar o girar solo cambia el CSS: no se pierde el texto escrito ni la revisión abierta.
