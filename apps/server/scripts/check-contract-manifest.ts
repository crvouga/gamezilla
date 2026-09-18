// @io-wall-ok — contract manifest CLI entry root (scripts/**).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_MUTATIONS } from '../src/sync/app-mutations';
import { APP_QUERIES } from '../src/sync/app-queries';

/**
 * Every query and mutation name ever shipped to a client is append-only.
 * Renaming or removing one makes an offline client's queued mutation resolve to
 * `UNKNOWN_MUTATION` — a permanent rejection whose queue row is then dropped.
 * Freezing the name set in a committed manifest makes that impossible to merge.
 */
export type ContractManifest = {
  readonly mutations: readonly string[];
  readonly queries: readonly string[];
};

const MANIFEST_PATH = resolve(import.meta.dir, '..', 'contract-manifest.json');

export function buildContractManifest(): ContractManifest {
  return {
    mutations: Object.keys(APP_MUTATIONS).sort(),
    queries: Object.keys(APP_QUERIES).sort(),
  };
}

export function serializeContractManifest(manifest: ContractManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function diffNames(
  field: 'mutations' | 'queries',
  committed: readonly string[],
  current: readonly string[]
): { removed: string[]; added: string[] } {
  const currentSet = new Set(current);
  const committedSet = new Set(committed);
  return {
    removed: committed
      .filter((n) => !currentSet.has(n))
      .map((n) => `${field}:${n}`),
    added: current
      .filter((n) => !committedSet.has(n))
      .map((n) => `${field}:${n}`),
  };
}

function main(): void {
  const current = buildContractManifest();
  if (process.argv.includes('--write')) {
    writeFileSync(MANIFEST_PATH, serializeContractManifest(current), 'utf8');
    console.log('contract manifest written');
    return;
  }
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      'contract-manifest.json is missing — restore it, or run: bun run --filter @apps/server check:contract --write'
    );
  }
  const committed = JSON.parse(
    readFileSync(MANIFEST_PATH, 'utf8')
  ) as ContractManifest;
  const mutations = diffNames(
    'mutations',
    committed.mutations,
    current.mutations
  );
  const queries = diffNames('queries', committed.queries, current.queries);
  const removed = [...mutations.removed, ...queries.removed];
  const added = [...mutations.added, ...queries.added];
  if (removed.length > 0) {
    throw new Error(
      [
        'contract names are append-only — removed or renamed:',
        ...removed,
        'a shipped client still uses these names; add a new name instead.',
      ].join('\n')
    );
  }
  if (added.length > 0) {
    throw new Error(
      [
        'contract-manifest.json is out of date; record the new names:',
        ...added,
        'run: bun run --filter @apps/server check:contract --write',
      ].join('\n')
    );
  }
  console.log(
    `contract manifest is valid (${String(current.mutations.length)} mutations, ${String(current.queries.length)} queries)`
  );
}

main();
