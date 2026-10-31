#!/usr/bin/env bun
// @io-wall-ok — gate entry: copies the repository to a temporary directory and runs tools there.
/**
 * `@libs/tools-harness-ts#verify:rebrand`: a synthetic rebrand, end to end,
 * in an isolated copy of the repository (docs/BRANDING.md).
 *
 * 1. Copy every tracked or new file; link each package's dependencies the
 *    way the install does, so workspace imports resolve inside the copy.
 * 2. Replace the copy's `brand` with a synthetic one (namespace and external
 *    identifiers unchanged).
 * 3. Regenerate every brand-derived artifact.
 * 4. Require that the old brand's name and domain appear nowhere outside the
 *    identity package (external identifiers excepted), that the brand policy
 *    passes for the new brand, that the brand-sensitive suites pass —
 *    including the infrastructure inputs keeping every resource name — and
 *    that the web client builds.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProductIdentity } from '@libs/product-identity-shared-ts/product-identity';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import type { ScannedFile } from './brand-policy';
import { oldBrandTraces } from './rebrand';

const ROOT = join(import.meta.dirname, '../../..');
const COPY_ROOT = { path: '' };
const IDENTITY = 'libs/product-identity/product-identity.json';

/** Brand-sensitive suites, run inside the copy (package dir, command). */
const SUITES: readonly (readonly [string, readonly string[]])[] = [
  ['libs/product-identity-shared-ts', ['bun', 'test', 'tests/']],
  ['libs/infra-shared-ts', ['bun', 'test', 'tests']],
  ['libs/infra-server-ts', ['bun', 'test', 'tests']],
  ['libs/observability-shared-ts', ['bun', 'test', 'tests']],
  ['libs/moderation-shared-ts', ['bun', 'test', 'tests']],
  ['libs/app-root-shared-ts', ['bun', 'test', 'tests']],
  ['libs/billing-shared-ts', ['bun', 'test', 'tests']],
  [
    'libs/app-root-client-ts',
    [
      'bun',
      'test',
      '--tsconfig-override',
      '../../tsconfig.json',
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      '@pkgs/bun-test-solid-client-ts/preload',
      'tests',
    ],
  ],
];

function run(cwd: string, command: readonly string[], label: string): void {
  const result = spawnSync(command[0] ?? 'bun', command.slice(1), {
    cwd,
    // The copy's mise.toml pins the same tools; trust it like the checkout.
    // A gate never reaches the outside world: Turbo in the copy keeps its
    // cache local.
    env: {
      ...process.env,
      MISE_TRUSTED_CONFIG_PATHS: COPY_ROOT.path,
      TURBO_CACHE: 'local:rw',
      TURBO_TOKEN: '',
      TURBO_TEAM: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status === 0) {
    console.log(`rebrand: ${label}: ok`);
    return;
  }
  console.error(
    `${result.stdout}\n${result.stderr}`
      .trim()
      .split('\n')
      .slice(-60)
      .join('\n')
  );
  throw new Error(`rebrand: ${label} failed (exit ${String(result.status)})`);
}

function listFiles(): string[] {
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (listed.status !== 0) throw new Error(listed.stderr);
  return listed.stdout
    .split('\0')
    .filter((path) => path.length > 0 && existsSync(join(ROOT, path)));
}

/** Copy the tree, then each package's `node_modules` as the same links. */
function copyRepository(files: readonly string[], copy: string): void {
  for (const path of files) {
    const target = join(copy, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, path), target, { verbatimSymlinks: true });
  }
  // The store and the root's tools are shared read-only with the original.
  symlinkSync(join(ROOT, 'node_modules'), join(copy, 'node_modules'), 'dir');
  for (const tier of ['apps', 'libs', 'pkgs'])
    for (const entry of readdirSync(join(ROOT, tier))) {
      const modules = join(ROOT, tier, entry, 'node_modules');
      if (!existsSync(modules)) continue;
      // Relative links: workspace packages resolve to the copy's packages.
      cpSync(modules, join(copy, tier, entry, 'node_modules'), {
        recursive: true,
        verbatimSymlinks: true,
      });
    }
}

function scan(copy: string, files: readonly string[]): ScannedFile[] {
  return files.map((path) => {
    const full = join(copy, path);
    if (!existsSync(full) || !statSync(full).isFile())
      return { path, text: null };
    const bytes = readFileSync(full);
    return {
      path,
      text: bytes.subarray(0, 8192).includes(0) ? null : bytes.toString('utf8'),
    };
  });
}

/**
 * A brand nobody spelled: derived from a hash of the current one, so no file
 * in the repository (this one included) can hold it by hand, and the brand
 * policy in the copy refuses exactly what a real rebrand would.
 */
function probeIdentity(identity: ProductIdentity): ProductIdentity {
  const tag = createHash('sha256')
    .update(identity.brand.name)
    .digest('hex')
    .slice(0, 8);
  return {
    ...identity,
    brand: {
      ...identity.brand,
      name: `Probe ${tag}`,
      shortName: `P${tag}`,
      domain: `probe-${tag}.example`,
      securityContact: `mailto:security@probe-${tag}.example`,
    },
  };
}

const files = listFiles();
const copy = mkdtempSync(join(tmpdir(), 'rebrand-'));
COPY_ROOT.path = copy;
try {
  copyRepository(files, copy);
  const synthetic = probeIdentity(PRODUCT);
  writeFileSync(
    join(copy, IDENTITY),
    `${JSON.stringify(
      { $schema: './product-identity.schema.json', ...synthetic },
      null,
      2
    )}\n`
  );
  console.log(
    `rebrand: ${PRODUCT.brand.domain} → ${synthetic.brand.domain} in ${copy}`
  );
  // A checkout: git lists files for the brand policy and Turbo.
  run(copy, ['git', 'init', '--quiet'], 'git init');
  run(copy, ['git', 'add', '--all'], 'git add');
  // Every gitignored generated file `bun install` writes (catalogs, tokens…).
  run(copy, ['bun', 'run', 'generate'], 'regenerate install-time outputs');
  run(
    copy,
    [
      'bun',
      'run',
      'libs/product-identity-shared-ts/scripts/generate-brand-artifacts.ts',
    ],
    'regenerate brand artifacts'
  );
  run(
    copy,
    ['bun', 'run', 'libs/observability-shared-ts/scripts/slo-generate.ts'],
    'regenerate SLO artifacts'
  );

  const traces = oldBrandTraces(scan(copy, files), PRODUCT);
  if (traces.length > 0) {
    for (const trace of traces.slice(0, 50))
      console.error(
        `  ${trace.path}:${String(trace.line)}: still says "${trace.spelling}"`
      );
    throw new Error(
      `rebrand: ${String(traces.length)} place(s) kept the old brand by hand (docs/BRANDING.md)`
    );
  }
  console.log('rebrand: no trace of the old brand outside the identity');

  run(
    copy,
    ['bun', 'run', 'libs/tools-harness-ts/scripts/verify-brand-policy.ts'],
    'brand policy for the new brand'
  );
  for (const [dir, command] of SUITES)
    run(join(copy, dir), command, `${dir} tests`);
  run(
    join(copy, 'apps/client-ts'),
    ['bun', 'x', 'vite', 'build', '--logLevel', 'error'],
    'web client build'
  );
  console.log(
    'rebrand: the synthetic rebrand regenerates, verifies and builds'
  );
} finally {
  removeTree(copy);
}
