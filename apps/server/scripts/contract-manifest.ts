// @io-wall-ok — contract manifest CLI entry root (scripts/**).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP } from '@libs/runtime/root/app-features';

/**
 * Every query and mutation name ever shipped to a client is append-only.
 * Renaming or removing one makes an offline client's queued mutation resolve to
 * `UNKNOWN_MUTATION` — a permanent rejection whose queue row is then dropped.
 * Freezing the name set in a committed manifest makes that impossible to merge;
 * `tests/contract-manifest.test.ts` holds the line. Run this file to record
 * new names: `bun run --filter @apps/server contract:write`.
 */
export type ContractManifest = {
  readonly mutations: readonly string[];
  readonly queries: readonly string[];
};

const MANIFEST_PATH = resolve(import.meta.dir, '..', 'contract-manifest.json');

export async function buildContractManifest(): Promise<ContractManifest> {
  return {
    mutations: Object.keys(await APP.mutations()).sort(),
    queries: Object.keys(APP.queries).sort(),
  };
}

export function readCommittedContractManifest(): ContractManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ContractManifest;
}

/** `field:name` for every name in `from` that `to` does not have. */
export function missingNames(
  from: ContractManifest,
  to: ContractManifest
): readonly string[] {
  return (['mutations', 'queries'] as const).flatMap((field) => {
    const present = new Set(to[field]);
    return from[field]
      .filter((name) => !present.has(name))
      .map((name) => `${field}:${name}`);
  });
}

if (import.meta.main) {
  const manifest = await buildContractManifest();
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('contract manifest written');
}
