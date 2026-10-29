#!/usr/bin/env bun
// @io-wall-ok — verification CLI entry (scripts/**).
/**
 * `verify:worker-bundle`: bundle this package's Cloudflare Worker exactly as
 * release ships it (`wrangler deploy --dry-run`; `wrangler.toml` is env-agnostic,
 * libs/infra only renames it per environment) and hold the
 * result under the platform's size limit.
 *
 * Without it `bun verify` never bundles a Worker — `build` is a no-op for the
 * Worker apps and only release runs wrangler — so an import the Workers runtime
 * cannot resolve, or a bundle past the upload limit, passed the gate and
 * failed the release. Offline (no Cloudflare credentials), ~3 s, and cached
 * per package like every other verification.
 *
 * It first holds `wrangler.toml`'s `compatibility_date` at or below what the
 * pinned workerd supports (see `worker-compat-date.ts`): the dry-run bundles
 * a Worker whose date the runtime would refuse to boot.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { resolveIdentityPlaceholders } from '@libs/product-identity-shared-ts/identity-placeholders';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import {
  compatibilityDateProblem,
  readCompatibilityDate,
  readWorkerdSupportedDate,
} from './worker-compat-date';

/**
 * Cloudflare's Workers Free upload limit (compressed). Paid allows 10 MiB;
 * staying under the lower bar keeps cold starts cheap and leaves headroom.
 */
const WORKER_GZIP_LIMIT_BYTES = 3 * 1024 * 1024;

const pkgDir = process.cwd();

// workerd is wrangler's dependency, so resolve it from wrangler's location.
const wranglerPkg = createRequire(join(pkgDir, 'package.json')).resolve(
  'wrangler/package.json'
);
const workerdMain = createRequire(wranglerPkg).resolve('workerd');
const configured = readCompatibilityDate(
  readFileSync(join(pkgDir, 'wrangler.toml'), 'utf8')
);
const supported = readWorkerdSupportedDate(readFileSync(workerdMain, 'utf8'));
if (configured === null || supported === null) {
  console.error(
    `worker bundle: could not read compatibility dates (wrangler.toml: ${configured}, ${workerdMain}: ${supported})`
  );
  process.exit(1);
}
const dateProblem = compatibilityDateProblem(configured, supported);
if (dateProblem !== null) {
  console.error(`worker bundle: ${dateProblem}`);
  process.exit(1);
}
const outDir = join(pkgDir, '.cache/worker-bundle');
removeTree(outDir);

/** A path relative to the package, seen from one directory below it. */
function reRoot(path: unknown): unknown {
  if (typeof path !== 'string' || path.startsWith('/')) return path;
  return `../${path.replace(/^\.\//, '')}`;
}

// `wrangler.toml` spells identity placeholders (`{namespace}`), which Release
// resolves before wrangler reads it (docs/BRANDING.md): bundle that same
// config. It is written one directory below the package, so its relative
// paths are re-rooted by one level.
const committed = resolveIdentityPlaceholders(
  Bun.TOML.parse(readFileSync(join(pkgDir, 'wrangler.toml'), 'utf8')) as Record<
    string,
    unknown
  >
);
const assets = committed['assets'] as Record<string, unknown> | undefined;
const rendered = {
  ...committed,
  main: reRoot(committed['main']),
  ...(assets === undefined
    ? {}
    : { assets: { ...assets, directory: reRoot(assets['directory']) } }),
};
mkdirSync(join(pkgDir, '.cache'), { recursive: true });
const config = join(pkgDir, '.cache/worker-bundle.wrangler.json');
writeFileSync(config, JSON.stringify(rendered, null, 2));

const result = spawnSync(
  'wrangler',
  ['deploy', '--dry-run', '--config', config, '--outdir', outDir],
  {
    cwd: pkgDir,
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  }
);
if (result.status !== 0) {
  process.stderr.write(result.stdout + result.stderr);
  console.error(`worker bundle: wrangler dry-run failed in ${pkgDir}`);
  process.exit(1);
}

const bundles = readdirSync(outDir).filter((name) => name.endsWith('.js'));
if (bundles.length === 0) {
  console.error(`worker bundle: wrangler wrote no .js to ${outDir}`);
  process.exit(1);
}

let failed = false;
for (const name of bundles) {
  const gzipBytes = gzipSync(readFileSync(join(outDir, name))).byteLength;
  const kib = (gzipBytes / 1024).toFixed(0);
  const limitKib = (WORKER_GZIP_LIMIT_BYTES / 1024).toFixed(0);
  if (gzipBytes > WORKER_GZIP_LIMIT_BYTES) {
    console.error(
      `worker bundle: ${name} is ${kib} KiB gzip > ${limitKib} KiB`
    );
    failed = true;
  } else {
    console.log(
      `worker bundle: ${name} ${kib} KiB gzip (limit ${limitKib} KiB)`
    );
  }
}
process.exit(failed ? 1 : 0);
