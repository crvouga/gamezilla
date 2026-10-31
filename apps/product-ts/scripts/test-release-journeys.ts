// @io-wall-ok — CI owns the stack, production bundle, browser process and teardown.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Denial } from '@pkgs/aedes-server-ts/start';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { build } from 'vite';
import { bootLocalhostStack } from './boot-stack';
import { brokerVerdict } from './broker-denials';
import type { DatabaseLink } from './database-link';
import {
  DOCUMENT_CACHE_CONTROL,
  SQLITE_WEB_COEP,
  SQLITE_WEB_COOP,
} from './dist-headers';
import { healthTestArguments, parseCli, selectSpecs } from './health';
import { LOCAL_MONITOR_TOKEN } from './local-api-env';
import { removeManifest, type StackManifest } from './manifest';
import { databaseVerdict, profileOf } from './production-database';
import {
  prepareReleasePublic,
  releaseArtifacts,
  removeReleaseArtifacts,
  writeReleaseStubs,
} from './release-artifacts';
import { printReleasePairingEvidence } from './release-failure-diagnostics';
import { releaseFailureTraces } from './release-failure-traces';
import { printReleaseQueryEvidence } from './release-query-diagnostics';
import {
  parseReleasePart,
  releaseSpecs,
  splitReleaseSpecs,
} from './release-selection';
import { specProcessExit } from './spec-process';
import { parseStackOptions } from './stack-options';

const PACKAGE_DIR = join(import.meta.dir, '..');
const REPO_ROOT = join(PACKAGE_DIR, '../..');
const part = parseReleasePart(process.argv.slice(2));
const artifacts = releaseArtifacts(PACKAGE_DIR, part);
// The journeys reach Postgres as the deployed API does (round trip, session
// pool, per-request cost) and over a network with a round trip, because they
// decide whether a change can deploy.
const options = parseStackOptions([
  '--synthetic-population-workers=0',
  '--production-database',
  '--edge-latency-ms=50',
]);
// `--part=<k>/<n>` picks the share of specs; `bun test` never sees it.
const cli = parseCli(
  process.argv.slice(2).filter((arg) => !arg.startsWith('--part='))
);

async function buildRelease(apiOrigin: string): Promise<void> {
  prepareReleasePublic(PACKAGE_DIR, artifacts);
  process.env['PRODUCT_PUBLIC_DIR'] = artifacts.publicDir;
  process.env['VITE_API_URL'] = apiOrigin;
  // Exercise the shipped build: no harness probes, dev mode or HMR.
  process.env['VITE_TEST_HOOKS'] = '0';
  process.env['VITE_COMMIT_HASH'] = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
  })
    .toString()
    .trim();
  process.env['VITE_COMMIT_DATE'] = execFileSync(
    'git',
    ['log', '-1', '--format=%cI', 'HEAD'],
    { cwd: REPO_ROOT }
  )
    .toString()
    .trim();
  await build({
    configFile: join(PACKAGE_DIR, 'vite.config.mts'),
    mode: 'production',
    cacheDir: artifacts.viteCacheDir,
    build: { outDir: artifacts.distDir, emptyOutDir: true },
  });
  const { buildServiceWorker } = await import('./build-sw');
  await buildServiceWorker(artifacts.distDir);
}

function serveRelease(origin: string): ReturnType<typeof Bun.serve> {
  const store = createNodeFsObjectStore({
    rootDir: artifacts.distDir,
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
          'Cross-Origin-Opener-Policy': SQLITE_WEB_COOP,
          'Cross-Origin-Embedder-Policy': SQLITE_WEB_COEP,
          // As production serves documents (`dist-headers.ts`).
          ...(file.contentType.startsWith('text/html')
            ? { 'Cache-Control': DOCUMENT_CACHE_CONTROL }
            : {}),
        },
      });
    },
  });
}

/** A feature costs about what it has scenarios; a part runs its share. */
function scenarioCount(spec: string): number {
  return (readFileSync(spec, 'utf8').match(/^\s*Scenario/gm) ?? []).length;
}

function specsToRun(): readonly string[] {
  const all = releaseSpecs();
  if (part === null) return all;
  return splitReleaseSpecs(all, part.parts, scenarioCount)[part.part] ?? [];
}

function journeyStubs(): readonly string[] {
  const selection = selectSpecs({ all: specsToRun(), cli });
  if (!selection.ok) throw new Error(selection.error);
  return writeReleaseStubs(PACKAGE_DIR, selection.specs, artifacts);
}

/** A run whose requests cost more than the deployed database allows has not passed. */
function databaseExitCode(booted: {
  readonly databaseLink: DatabaseLink | null;
}): number {
  if (booted.databaseLink === null) return 0;
  const summary = booted.databaseLink.summary();
  const verdict = databaseVerdict(summary);
  console.log(
    `database link: ${String(summary.connections)} requests, at most ${String(summary.peakSessions)} pooled sessions at once; costliest:\n  ${verdict.costliest.join('\n  ')}`
  );
  if (!verdict.ok || process.env['STACK_DATABASE_PROFILE'] === '1')
    console.log(`database link profile:\n${profileOf(summary)}`);
  for (const violation of verdict.violations)
    console.error(`database link: ${violation}`);
  return verdict.ok ? 0 : 1;
}

/** A device AWS IoT would have dropped has not passed, whatever its screens showed. */
function brokerExitCode(booted: {
  brokerDenials(): readonly Denial[];
}): number {
  const verdict = brokerVerdict(booted.brokerDenials());
  for (const violation of verdict.violations)
    console.error(`broker: ${violation}`);
  return verdict.ok ? 0 : 1;
}

/** Narrate collected server work before the failed run's temporary files go away. */
async function printFailureTraces(manifest: StackManifest): Promise<void> {
  if (manifest.observabilityTraceDir === null) {
    console.error('Release failure traces unavailable: tracing was disabled.');
    return;
  }
  const store = (rootDir: string) =>
    createNodeFsObjectStore({ rootDir, fs: wallNodeFs(), layout: 'tree' });
  try {
    console.error(
      await releaseFailureTraces({
        reports: store(artifacts.reportDir),
        telemetry: store(manifest.observabilityTraceDir),
        run: { startMs: manifest.startedAtMs, endMs: wallClock.now() },
        mutationNames: ['findChessOpponent', 'createSpace'],
      })
    );
  } catch {
    console.error(
      'Release failure trace narration unavailable: collected data could not be read.'
    );
  }
}

/** Teardown scratch: Windows may still hold a just-stopped stack's files. */
function removeScratch(path: string): void {
  removeTree(path, { whenLocked: 'leave' });
}

// Retain bounded statement profiles so a failed release check identifies the
// expensive work after connection setup, rather than only its first queries.
process.env['STACK_DATABASE_PROFILE'] = '1';
const stack = await bootLocalhostStack(options, true, 'isolated');
let server: ReturnType<typeof serveRelease> | undefined;
try {
  await buildRelease(stack.manifest.apiOrigin);
  server = serveRelease(stack.manifest.webOrigin);
  const code = await specProcessExit(
    spawn('bun', healthTestArguments(cli, journeyStubs()), {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        SPEC_WORLD: 'release',
        CRITICAL_JOURNEY_EVIDENCE_DIR: artifacts.evidenceDir,
        SYNTHETIC_MONITOR_TOKEN: LOCAL_MONITOR_TOKEN,
        SPEC_TAGS: '',
        LOCALHOST_STACK_MANIFEST: stack.manifestPath,
      },
    })
  );
  const databaseCode = databaseExitCode(stack);
  const brokerCode = brokerExitCode(stack);
  if (code !== 0) {
    await printReleaseQueryEvidence(stack.manifest.observabilityTraceDir).catch(
      (error: unknown) =>
        console.error(`release query evidence failed: ${String(error)}`)
    );
    await printReleasePairingEvidence(stack.manifest.databaseUrl).catch(
      (error: unknown) =>
        console.error(`release pairing evidence failed: ${String(error)}`)
    );
  }
  process.exitCode = code === 0 ? databaseCode || brokerCode : code;
} finally {
  await server?.stop(true);
  await stack.stop();
  if (process.exitCode !== undefined && process.exitCode !== 0)
    await printFailureTraces(stack.manifest);
  removeManifest(REPO_ROOT, options.instanceId);
  if (!options.keepData) removeScratch(stack.manifest.dataDir);
  removeReleaseArtifacts(
    artifacts,
    process.env['VERIFY_PROFILE'] === 'nightly'
  );
}
