// @io-wall-ok — stream compressed archives and separate verdicts from rendered evidence.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tarPath } from './verify-evidence-archive';

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
  ] as const) {
    // Run in `root` so the archive and member names are relative for any tar.
    const packed = spawnSync(
      'tar',
      [
        '-czf',
        tarPath(root, join(root, directory, `${kind}-${index}.tar.gz`)),
        ...entries,
      ],
      { cwd: root }
    );
    if (packed.status !== 0) throw new Error(`Cannot transfer shard ${kind}`);
  }
}
