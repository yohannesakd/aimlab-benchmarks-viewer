import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from "node:url";
import { execFileSync } from 'node:child_process';
const apiOrigin = process.env.AIMLAB_API_ORIGIN || 'http://127.0.0.1:5282';
const release = process.env.AIMLAB_APP_RELEASE || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
export default defineConfig({
  define: { 'import.meta.env.VITE_APP_RELEASE': JSON.stringify(release) },
  build: { sourcemap: Boolean(process.env.POSTHOG_CLI_API_KEY) || process.env.AIMLAB_ENV === 'production' },
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": apiOrigin,
    },
  },
});
