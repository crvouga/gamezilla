// @io-wall-ok — stream compressed archives and separate verdicts from rendered evidence.
import { join, resolve } from 'node:path';
import { evidenceTar } from './verify-evidence-archive';

export function packShardEvidence(
  root: string,
  index: number,
  paths: readonly string[],
  directory = '.cache/verify-ci'
): void {
  const metadata = paths.filter(
    (path) =>
      path === `.cache/verify-ci/results/shard-${index}.json` ||
      path === '.cache/verify-ci/plan.payload'
  );
  for (const [kind, entries] of [
    ['results', metadata],
    ['evidence', paths],
  ] as const)
    evidenceTar(
      [
        'pack',
        join(resolve(root), directory, `${kind}-${index}.tar.gz`),
        resolve(root),
        ...entries,
      ],
      `Cannot transfer shard ${kind}`
    );
}
