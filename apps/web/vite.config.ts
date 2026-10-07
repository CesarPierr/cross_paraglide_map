import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is relative so the build works both on GitHub Pages (/<repo>/) and at a domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  // In development the API (npm run dev:api) answers on :8080; without it the app falls back to static files.
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
