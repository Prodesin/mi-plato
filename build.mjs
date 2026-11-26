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

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
