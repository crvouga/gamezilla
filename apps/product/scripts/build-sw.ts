// @io-wall-ok
/**
 * Post-process step after `vite build`: generates `dist/sw.js` via Workbox for
 * the super-app (wall client at `/` needs `VITE_API_URL` + commit meta).
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

import { readDistGraph } from './dist-graph';
import {
  keepInPrecache,
  PRECACHE_BUDGET_BYTES,
  PRECACHE_GLOB_IGNORES,
  PRECACHE_GLOB_PATTERNS,
  wallReachable,
} from './sw-policy';

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
const wallFiles = new Set(
  wallReachable(
    await readDistGraph(
      createNodeFsObjectStore({
        rootDir: distDir,
        fs: wallNodeFs(),
        layout: 'tree',
      })
    )
  )
);

const { count, size, warnings } = await generateSW({
  swDest: join(distDir, 'sw.js'),
  globDirectory: distDir,
  /**
   * Offline shell (`sw-policy.ts`): precache every file the wall client can
   * load, including the complete eager entry graph.
   * No per-file cap below the total budget, so Workbox never silently skips
   * a large chunk; `check:offline-shell` enforces the budget on the result.
   */
  maximumFileSizeToCacheInBytes: PRECACHE_BUDGET_BYTES,
  globPatterns: [...PRECACHE_GLOB_PATTERNS],
  globIgnores: [...PRECACHE_GLOB_IGNORES],
  manifestTransforms: [
    (entries) => ({
      manifest: entries.filter((entry) => keepInPrecache(entry.url, wallFiles)),
      warnings: [],
    }),
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
