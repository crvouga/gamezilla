// @io-wall-ok — build-tool composition root.
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

/**
 * Where `bun run web:dev` sends everything that is not the SPA itself. The
 * standalone IdP prints its own origin; `IDP_DEV_ORIGIN` points at it.
 */
const DEV_ORIGIN = process.env['IDP_DEV_ORIGIN'] ?? 'http://127.0.0.1:4319';

const PROXIED = [
  '/rpc',
  '/o/',
  '/token',
  '/tokeninfo',
  '/v1/',
  '/revoke',
  '/oauth2/',
  '/.well-known',
  '/__idp',
  '/idp-assets',
];

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  root: 'web',
  build: {
    target: 'es2022',
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    proxy: Object.fromEntries(
      PROXIED.map((path) => [path, { target: DEV_ORIGIN, changeOrigin: true }])
    ),
  },
});
