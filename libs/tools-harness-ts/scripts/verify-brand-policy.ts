#!/usr/bin/env bun
// @io-wall-ok — repository gate entry: lists files with git and reads them.
/**
 * `@libs/tools-harness-ts#verify:brand-policy`: fails when any file outside
 * `@libs/product-identity` (and verified generated artifacts) spells the
 * product's brand, namespace, external identifiers or an alias, in its
 * content or its path (`brand-policy.ts`, docs/BRANDING.md).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_ARTIFACTS } from '@libs/product-identity-shared-ts/brand-artifacts';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import {
  brandTokens,
  brandViolations,
  type GeneratedArtifact,
  renderViolation,
  type ScannedFile,
  verifiedArtifacts,
} from './brand-policy';

const ROOT = join(import.meta.dirname, '../../..');
const MAX_TEXT_BYTES = 8 * 1024 * 1024;

function listFiles(): string[] {
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (listed.status !== 0)
    throw new Error(`git ls-files failed: ${listed.stderr.trim()}`);
  return listed.stdout
    .split('\0')
    .filter((path) => path.length > 0 && existsSync(join(ROOT, path)));
}

function read(path: string): ScannedFile {
  const full = join(ROOT, path);
  if (!statSync(full).isFile() || statSync(full).size > MAX_TEXT_BYTES)
    return { path, text: null };
  const bytes = readFileSync(full);
  const sniff = bytes.subarray(0, 8192);
  return { path, text: sniff.includes(0) ? null : bytes.toString('utf8') };
}

const registry = JSON.parse(
  readFileSync(
    join(ROOT, 'libs/product-identity/generated-artifacts.json'),
    'utf8'
  )
) as { artifacts: GeneratedArtifact[] };
// Every brand artifact is checked by one freshness test that renders them all.
const brandArtifacts: GeneratedArtifact[] = BRAND_ARTIFACTS.map((artifact) => ({
  path: artifact.path,
  generator:
    'bun run libs/product-identity-shared-ts/scripts/generate-brand-artifacts.ts',
  freshnessTest:
    'libs/product-identity-shared-ts/tests/brand-artifacts.test.ts',
}));
const { exempt, problems } = verifiedArtifacts(
  [...registry.artifacts, ...brandArtifacts],
  (path) =>
    existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), 'utf8') : null
);
// `verify-brand-policy.ts <path prefix>…` reports only those paths, in full.
const only = process.argv.slice(2);
const files = listFiles()
  .filter(
    (path) =>
      only.length === 0 || only.some((prefix) => path.startsWith(prefix))
  )
  .map(read);
const shown = only.length > 0 ? Number.POSITIVE_INFINITY : 400;
const violations = brandViolations(files, brandTokens(PRODUCT), exempt);

if (problems.length > 0 || violations.length > 0) {
  console.error(
    [
      `brand policy (docs/BRANDING.md): ${String(violations.length)} spelling(s) outside @libs/product-identity`,
      ...problems.map((problem) => `  registry: ${problem}`),
      ...violations.slice(0, shown).map((v) => `  ${renderViolation(v)}`),
      violations.length > shown
        ? `  … and ${String(violations.length - shown)} more (name path prefixes to see them all)`
        : '',
      'Read the value from @libs/product-identity-shared-ts (brand, NAMESPACE, external ids), use a {namespace} / {domain} / {brand} placeholder where code cannot import, or register a generated artifact with a freshness test.',
    ]
      .filter((line) => line !== '')
      .join('\n')
  );
  process.exit(1);
}
console.log(
  `brand policy: ${String(files.length)} files, none spells the brand outside @libs/product-identity (${String(exempt.size)} verified generated artifacts)`
);
