import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Bridge until packages/engine exports "./art" (requested on the BOARD): point the subpaths at their source.
const engineSrc = (sub: string) =>
  decodeURIComponent(
    new URL(`../../packages/engine/src/${sub}/index.ts`, import.meta.url).pathname,
  );

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@degamed\/engine\/art$/, replacement: engineSrc('art') },
    ],
  },
  server: { port: 5173 },
});
