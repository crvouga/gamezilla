// @io-wall-ok — recorded-report discovery at the conformance CLI filesystem boundary.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lastSegment } from '@pkgs/os-shared-ts/slash-path';

function subdirs(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name));
}

/** Report dirs under `dir` holding an `evidence/` folder, `dir` included. */
function withEvidence(dir: string, depth: number): readonly string[] {
  if (!existsSync(dir)) return [];
  const own = existsSync(join(dir, 'evidence')) ? [dir] : [];
  if (depth === 0) return own;
  return [
    ...own,
    ...subdirs(dir)
      .filter((sub) => lastSegment(sub) !== 'evidence')
      .flatMap((sub) => withEvidence(sub, depth - 1)),
  ];
}

/** Every report bucket in the repository that may hold evidence. */
export function reportBuckets(repoRoot: string): readonly string[] {
  return [
    ...['apps', 'libs', 'pkgs'].flatMap((tier) =>
      subdirs(join(repoRoot, tier)).flatMap((pkg) => [
        // Only the gate's buckets (`test:spec:<k>`, `verify:models`); an
        // ad-hoc `bun run spec` writes `all/`, from whatever implementation
        // was on disk then.
        ...subdirs(join(pkg, '.cache/harness-report')).filter((bucket) =>
          /^(part-\d+|models)$/.test(lastSegment(bucket))
        ),
        ...withEvidence(join(pkg, '.cache/health-report'), 2),
        ...withEvidence(join(pkg, '.cache/health-objectives-report'), 2),
      ])
    ),
  ];
}
