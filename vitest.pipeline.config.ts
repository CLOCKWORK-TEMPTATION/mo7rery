/**
 * إعدادات vitest مبسطة لاختبارات pipeline فقط
 * تتجنب الاعتماد على @vitejs/plugin-react
 */
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/unit/pipeline/**/*.test.ts",
      "tests/unit/extensions/line-repair.test.ts",
      "tests/unit/extensions/classification-decision.test.ts",
    ],
  },
});
