import { defineConfig } from 'vite';

// The play sandbox: runs untrusted game code on its own origin (see public/_headers).
// The iframe is sandboxed without allow-same-origin, so its origin is "null" and module
// scripts load as CORS requests: the server must allow any origin for its static files.
export default defineConfig({
  server: { port: 5174, strictPort: true, cors: { origin: '*' } },
  build: { chunkSizeWarningLimit: 2000 },
});
