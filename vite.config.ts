import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.{test,spec}.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
