import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
    cli: "src/cli.ts",
  },
  format: ["esm", "cjs"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  treeshake: true,
  outDir: "dist",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
