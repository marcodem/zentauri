import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import pkg from "./package.json";

let gitHash = "dev";
let commitCount = "1";
try {
  gitHash = execSync("git rev-parse --short HEAD").toString().trim();
  commitCount = execSync("git rev-list --count HEAD").toString().trim();
} catch (e) {}

const buildNumber =
  process.env.GITHUB_RUN_NUMBER || process.env.BUILD_NUMBER || commitCount;

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  test: {
    environment: "jsdom",
  },
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  optimizeDeps: {
    include: ["markdown-it-extensible"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
