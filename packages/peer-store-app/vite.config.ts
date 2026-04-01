import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const dir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(dir, '..', '..')

export default defineConfig({
  base: './',
  root: dir,
  plugins: [react(), tailwindcss(), tsconfigPaths({ root: repoRoot })],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: { allow: [repoRoot, dir] },
  },
  build: {
    outDir: path.join(dir, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  publicDir: false,
})
