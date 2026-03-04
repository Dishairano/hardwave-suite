import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGhPages = process.env.DEPLOY_TARGET === 'gh-pages'

export default defineConfig(async () => ({
  plugins: [react()],
  base: isGhPages ? '/hardwave-suite/' : '/',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
