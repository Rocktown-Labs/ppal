import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/@ppal\/.*/u],
    neverBundle: ["cloudflare:workers"],
  },
  dts: false,
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
});
