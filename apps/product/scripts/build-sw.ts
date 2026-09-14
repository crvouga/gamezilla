// @io-wall-ok
/**
 * Post-process step after `vite build`: generates `dist/sw.js` via Workbox for
 * the super-app (wall client at `/` needs `VITE_API_URL` + commit meta).
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
  } as unknown as NodeModule;
}

stubBabelRegexpPlugins();
const { generateSW } = require('workbox-build') as {
  generateSW: typeof import('workbox-build').generateSW;
};

const log = createLogger({ name: 'product:build-sw', now: wallClock.now });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');

const { count, size, warnings } = await generateSW({
  swDest: join(distDir, 'sw.js'),
  globDirectory: distDir,
  /**
   * Offline shell: HTML/JS/CSS/WASM/fonts/icons only. Cap at 1 MiB so DiceBear,
   * mutation hubs, and CanvasKit stay out of first-install precache.
   * Apple splash PNGs are device-specific (runtime image cache), not precache.
   */
  maximumFileSizeToCacheInBytes: 1024 * 1024,
  globPatterns: [
    '**/*.{html,js,css,wasm,ttf,woff2,svg,ico,webmanifest,json}',
  ],
  globIgnores: [
    '**/apple-splash-*.png',
    '**/generated/**',
    '**/*dicebear*.js',
    '**/*with-framework-mutations*.js',
    '**/*game-plugins*.js',
    '**/*create-local-sync-engine*.js',
    '**/*.map',
  ],
  navigateFallback: '/index.html',
  // Keep SharedWorker + OPFS wipe assets as real static files (not the SPA shell).
  navigateFallbackDenylist: [
    /^\/api\//,
    /^\/sql-workers\//,
    /^\/sim-console\//,
  ],
  runtimeCaching: [
    {
      urlPattern: /^\/api\//,
      handler: 'NetworkOnly' as const,
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
