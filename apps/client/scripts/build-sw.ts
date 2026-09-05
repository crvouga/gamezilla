// @io-wall-ok
/**
 * Post-process step after `expo export -p web`: generates `dist/sw.js` via Workbox.
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';

const require = createRequire(import.meta.url);

/**
 * Workbox's Babel preset-env loads regexp plugins → regenerate.
 * A second `regenerate` copy (outside this repo) makes `instanceof` fail.
 * Stub the shared helper so those plugins never touch regenerate.
 */
function stubBabelRegexpPlugins(): void {
  const createRegExpFeaturePlugin = () => ({ visitor: {} });
  const exported = Object.assign(createRegExpFeaturePlugin, {
    createRegExpFeaturePlugin,
    default: createRegExpFeaturePlugin,
  });
  const workboxDir = dirname(require.resolve('workbox-build/package.json'));
  const presetEnvDir = dirname(
    require.resolve('@babel/preset-env/package.json', { paths: [workboxDir] })
  );
  const filename = require.resolve(
    '@babel/helper-create-regexp-features-plugin',
    { paths: [presetEnvDir] }
  );
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports: exported,
    children: [],
    paths: [],
  } as NodeModule;
}

stubBabelRegexpPlugins();
const { generateSW } = require('workbox-build') as {
  generateSW: typeof import('workbox-build').generateSW;
};

const log = createLogger({ name: 'client:build-sw', now: wallClock.now });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');

const { count, size, warnings } = await generateSW({
  swDest: join(distDir, 'sw.js'),
  globDirectory: distDir,
  /** Metro web bundles can exceed Workbox's default 2 MiB cap; offline shell needs the main chunk. */
  maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
  globPatterns: [
    '**/*.{html,js,css,wasm,ttf,woff2,png,jpg,jpeg,svg,ico,webmanifest,json}',
  ],
  navigateFallback: '/index.html',
  // Keep SharedWorker + OPFS wipe assets as real static files (not the SPA shell).
  navigateFallbackDenylist: [/^\/api\//, /^\/sql-workers\//],
  runtimeCaching: [
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
  console.warn('workbox warnings:', warnings.join('\n'));
}
log.info(`workbox: precached ${count} entries, ${size} bytes`);
