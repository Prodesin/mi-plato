// Compila src/main.tsx → app.js (un único bundle minificado, sin dependencias externas en ejecución).
import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["safari15", "chrome100"],
  outfile: "app.js",
  jsx: "automatic",
  jsxImportSource: "preact",
  alias: { react: "preact/compat", "react-dom": "preact/compat" },
  legalComments: "none",
  logLevel: "info",
};

// Decodificador ZXing (respaldo del escáner en iOS): paquete aparte que se carga bajo demanda.
const zxing = { ...options, entryPoints: ["src/zxing-entry.ts"], outfile: "zxing.js", jsx: undefined, jsxImportSource: undefined, alias: undefined };

if (process.argv.includes("--watch")) {
  await (await context(options)).watch();
  await (await context(zxing)).watch();
} else {
  await build(options);
  await build(zxing);
}
