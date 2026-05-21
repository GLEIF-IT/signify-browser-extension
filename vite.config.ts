import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

const rootDir = resolve(__dirname, "src");
const publicDir = resolve(__dirname, "public");
const isDev = process.env.__DEV__ === "false";
const targetBrowser = process.env.BROWSER || "chrome";
const outDir = resolve(__dirname, `dist/${targetBrowser}`);

function generateManifest() {
  const manifest = readJsonFile(`manifest.${targetBrowser}.json`);
  const pkg = readJsonFile("package.json");
  return {
    ...manifest,
    name: pkg.displayName ?? pkg.name,
    description: pkg.description,
    version: pkg.version,
  };
}

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
  plugins: [
    react(),
    webExtension({
      manifest: generateManifest,
    }),
  ],
  publicDir,
  build: {
    outDir,
    sourcemap: isDev,
    emptyOutDir: false,
  },
});
