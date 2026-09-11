import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
  extends: [core, react, tanstack],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "apps/web/src/routeTree.gen.ts",
    "apps/web/src/components/auth/**",
    "packages/ui/src/components/**",
    "apps/native/**",
    ".agents/**",
  ],
});
