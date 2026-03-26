import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dir, '..', '..', '..', '..', '..');

export default defineConfig({
  /** Relative `assets/` URLs so `file://` and `bun run viz:serve` both work. */
  base: './',
  root: dir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(repoRoot, 'src'),
      react: path.join(repoRoot, 'node_modules/react'),
      'react-dom': path.join(repoRoot, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom', 'sql.js'],
  },
  server: {
    fs: { allow: [repoRoot, dir] },
  },
  build: {
    outDir: path.join(repoRoot, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  publicDir: false,
});
