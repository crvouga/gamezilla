// @io-wall-ok — build-tool composition root.
/**
 * Builds the mock provider's hosted pages (Solid + Tailwind) into one JS and
 * one CSS file, which `scripts/build-mock-billing.ts` embeds in the server.
 */
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
      input: 'src/use-cases/mock-provider/client/main.tsx',
    },
  },
});
