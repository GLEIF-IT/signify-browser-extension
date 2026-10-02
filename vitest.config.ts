import { resolve } from "path";
import { defineConfig } from "vitest/config";

const rootDir = resolve(__dirname, "src");

export default defineConfig({
  resolve: {
    alias: {
      "@src": rootDir,
      "@assets": resolve(rootDir, "assets"),
      "@pages": resolve(rootDir, "pages"),
      "@components": resolve(rootDir, "components"),
      "@config": resolve(rootDir, "config"),
      "@shared": resolve(rootDir, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
