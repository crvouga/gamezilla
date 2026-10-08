// @io-wall-ok — stream compressed archives and separate verdicts from rendered evidence.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export function packShardEvidence(
  root: string,
  index: number,
  paths: readonly string[]
): void {
  const metadata = paths.filter(
    (path) =>
      path === `.cache/check-ci/results/shard-${index}.json` ||
      path === '.cache/check-ci/plan.payload'
  );
  for (const [kind, entries] of [
    ['results', metadata],
    ['evidence', paths],
  ] as const) {
    const packed = spawnSync('tar', [
      '-czf',
      join(root, '.cache/check-ci', `${kind}-${index}.tar.gz`),
      '-C',
      root,
      ...entries,
    ]);
    if (packed.status !== 0) throw new Error(`Cannot transfer shard ${kind}`);
  }
}
