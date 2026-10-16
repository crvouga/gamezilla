// @io-wall-ok — CI owns the stack, production bundle, browser process and teardown.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { build } from 'vite';
import { bootLocalhostStack } from './boot-stack';
import { healthTestArguments, parseCli, writeFeatureStubs } from './health';
import { removeManifest } from './manifest';
import { specProcessExit } from './spec-process';
import { parseStackOptions } from './stack-options';

const PACKAGE_DIR = join(import.meta.dir, '..');
const REPO_ROOT = join(PACKAGE_DIR, '../..');
const DIST = join(PACKAGE_DIR, '.cache/release-web');
const options = parseStackOptions([
  '--synthetic-population-workers=0',
  '--no-observability',
]);

async function buildRelease(apiOrigin: string): Promise<void> {
  process.env['VITE_API_URL'] = apiOrigin;
  // Exercise the shipped build: no harness probes, dev mode or HMR.
  delete process.env['VITE_TEST_HOOKS'];
  await build({
    configFile: join(PACKAGE_DIR, 'vite.config.mts'),
    mode: 'production',
    build: { outDir: DIST, emptyOutDir: true },
  });
  const { buildServiceWorker } = await import('./build-sw');
  await buildServiceWorker(DIST);
}

function serveRelease(origin: string): ReturnType<typeof Bun.serve> {
  const store = createNodeFsObjectStore({
    rootDir: DIST,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  return Bun.serve({
    hostname: '127.0.0.1',
    port: Number(new URL(origin).port),
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname).slice(1);
      if (path.split('/').includes('..'))
        return new Response(null, { status: 400 });
      const file =
        (await store.get(path || 'index.html')) ??
        (request.headers.get('accept')?.includes('text/html')
          ? await store.get('index.html')
          : null);
      if (file === null) return new Response(null, { status: 404 });
      return new Response(file.body, {
        headers: {
          'Content-Type': path.endsWith('.wasm')
            ? 'application/wasm'
            : file.contentType,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        },
      });
    },
  });
}

function journeyStubs(): readonly string[] {
  const dirs = {
    stubDir: join(PACKAGE_DIR, '.cache/spec-release'),
    reportDir: join(PACKAGE_DIR, '.cache/release-report'),
  };
  mkdirSync(dirs.stubDir, { recursive: true });
  return writeFeatureStubs(
    { production: false, observability: false },
    ['custom-game', 'join-and-offline'].map((name) =>
      join(REPO_ROOT, `specs/journeys/${name}.feature`)
    ),
    dirs,
    join(PACKAGE_DIR, 'tests/steps/release-index.ts')
  );
}

const stack = await bootLocalhostStack(options, true, 'isolated');
let server: ReturnType<typeof serveRelease> | undefined;
try {
  await buildRelease(stack.manifest.apiOrigin);
  server = serveRelease(stack.manifest.webOrigin);
  const code = await specProcessExit(
    spawn('bun', healthTestArguments(parseCli([]), journeyStubs()), {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        SPEC_WORLD: 'release',
        SPEC_TAGS: '',
        LOCALHOST_STACK_MANIFEST: stack.manifestPath,
      },
    })
  );
  process.exitCode = code;
} finally {
  await server?.stop(true);
  await stack.stop();
  removeManifest(REPO_ROOT, options.instanceId);
}
