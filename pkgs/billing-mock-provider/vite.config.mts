// @io-wall-ok — build-tool composition root.
/**
 * Builds the provider's hosted pages (Solid + Tailwind) into one JS and one
 * CSS file, which `scripts/build-web-assets.ts` embeds in the server bundle.
 */
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  logLevel: 'warn',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'web/src/main.tsx'),
    },
  },
});
