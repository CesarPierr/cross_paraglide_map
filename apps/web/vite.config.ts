import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** The build's date and commit (when git is there), for the game's flight logs. */
const build = (() => {
  let commit = '';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    /* no git (container build) */
  }
  return `${new Date().toISOString().slice(0, 16)}${commit ? ` ${commit}` : ''}`;
})();

// `base` is relative so the build works both on GitHub Pages (/<repo>/) and at a domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  define: { 'import.meta.env.VITE_BUILD': JSON.stringify(build) },
  // In development the API (npm run dev:api) answers on :8080; without it the app falls back to static files.
  // `ws: true` lets the multiplayer relay (/api/game/ws) through the same proxy.
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true, ws: true } } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
