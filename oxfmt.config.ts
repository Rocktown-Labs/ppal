import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ".agents/**",
    "packages/db/src/migrations/meta/**",
    "packages/db/src/migrations/**/snapshot.json",
    "apps/native/**",
  ],
});
