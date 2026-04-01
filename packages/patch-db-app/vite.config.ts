import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dir, '..', '..');

/** Dev: same-origin `/patch-db` → req res so SSE + POST work without browser CORS issues. */
const syncProxyTarget =
  process.env['PATCHDB_SYNC_PROXY_TARGET'] ?? 'http://127.0.0.1:5001';

export default defineConfig({
  /** Relative `assets/` URLs so `file://` and `bun run --filter @gamezilla/patch-db-app serve` both work. */
  base: './',
  root: dir,
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'sql.js'],
  },
  server: {
    fs: { allow: [repoRoot, dir] },
    proxy: {
      '/patch-db': {
        target: syncProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(dir, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  publicDir: false,
});
