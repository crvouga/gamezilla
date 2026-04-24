/**
 * Post-process step after `expo export -p web`: generates `dist/sw.js` via Workbox.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSW } from 'workbox-build';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');

const { count, size, warnings } = await generateSW({
  swDest: join(distDir, 'sw.js'),
  globDirectory: distDir,
  /** Metro web bundles can exceed Workbox's default 2 MiB cap; offline shell needs the main chunk. */
  maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
  globPatterns: [
    '**/*.{html,js,css,wasm,ttf,woff2,png,jpg,jpeg,svg,ico,webmanifest,json}',
  ],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/patch-db\//],
  runtimeCaching: [
    {
      urlPattern: /\/patch-db\//,
      handler: 'NetworkOnly' as const,
    },
    {
      urlPattern: /^\/api\//,
      handler: 'NetworkOnly' as const,
    },
    {
      urlPattern: /^https:\/\/fonts\.(gstatic|googleapis)\.com\//,
      handler: 'CacheFirst' as const,
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 3600,
        },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === 'image',
      handler: 'StaleWhileRevalidate' as const,
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 },
      },
    },
  ],
  cleanupOutdatedCaches: true,
  clientsClaim: false,
  skipWaiting: false,
});

if (warnings.length > 0) {
  // eslint-disable-next-line no-console -- build diagnostics
  console.warn('workbox warnings:', warnings.join('\n'));
}
// eslint-disable-next-line no-console -- build output
console.log(`workbox: precached ${count} entries, ${size} bytes`);
