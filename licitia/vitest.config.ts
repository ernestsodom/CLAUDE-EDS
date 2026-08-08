import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // El SDK de Anthropic expone "./lib/*" en su exports map, pero Vite no
      // resuelve subrutas por patrón contra ese mapa tan bien como Node/Next
      // (que sí lo hacen: el build de Next.js funciona sin este alias). Se
      // resuelve el archivo concreto a mano para que vitest lo encuentre.
      "@anthropic-ai/sdk/lib/transform-json-schema": path.resolve(
        __dirname,
        "./node_modules/@anthropic-ai/sdk/lib/transform-json-schema.js"
      ),
    },
  },
});
