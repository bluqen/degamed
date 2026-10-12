import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Bridge until packages/engine exports "./art" (requested on the BOARD): point the subpath at its source.
const artEntry = decodeURIComponent(new URL('../../packages/engine/src/art/index.ts', import.meta.url).pathname);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: /^@degamed\/engine\/art$/, replacement: artEntry }] },
  server: { port: 5173 },
});
