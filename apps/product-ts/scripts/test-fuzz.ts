#!/usr/bin/env bun
// @io-wall-ok
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { discoverSeededTests } from './discover';
import { formatShard, nightlyShard, shareOf } from './nightly-shard';
import { recordSeeds } from './seed-record';
import { owningPackagePath, testFileCommand } from './test-file-command';

const REPO_ROOT = join(import.meta.dirname, '../../..');

// `--seed-count=` wins; `HARNESS_FUZZ_SEEDS` is the budget a check profile
// sets (`libs/tools-harness-ts/scripts/verify-profile.ts`).
const seedCount = Number(
  process.argv
    .find((a) => a.startsWith('--seed-count='))
    ?.slice('--seed-count='.length) ??
    process.env['HARNESS_FUZZ_SEEDS'] ??
    '32'
);
// `HARNESS_SEED=<seed>` replays the one seed a failed run printed.
const replaySeed = process.env['HARNESS_SEED'];

const allFiles = (await discoverSeededTests(REPO_ROOT)).map((file) =>
  join(REPO_ROOT, file)
);
if (allFiles.length === 0) {
  console.error('No harness tests consume HARNESS_SEED');
  process.exit(1);
}
// Verify Nightly spreads the files over its runners; each draws its own seeds.
const shard = nightlyShard(process.env);
const files = shareOf(allFiles, shard);

const commands = files.map((file) => {
  const selected = slashPath(relative(REPO_ROOT, file));
  const packagePath = owningPackagePath(selected);
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, packagePath, 'package.json'), 'utf8')
  ) as { scripts: Record<string, string> };
  const script = manifest.scripts['test'] ?? manifest.scripts['test:contract'];
  if (script === undefined)
    throw new Error(`Package has no test task: ${packagePath}`);
  return { file, ...testFileCommand(selected, script) };
});

const seeds =
  replaySeed === undefined
    ? Array.from(
        { length: seedCount },
        (_, index) => ((Math.random() * 0xffffffff) >>> 0) ^ (index + 1)
      )
    : [Number(replaySeed)];

const record = {
  shard: formatShard(shard),
  seeds,
  files: files.length,
  suiteFiles: allFiles.length,
};
recordSeeds('fuzz', { ...record, failed: null });

for (const [index, seed] of seeds.entries()) {
  const i = index + 1;
  process.stdout.write(`::group::seed=${seed} (${i}/${seeds.length})\n`);
  for (const { file, argv, packagePath } of commands) {
    const result = spawnSync('bun', argv, {
      cwd: join(REPO_ROOT, packagePath),
      stdio: 'inherit',
      env: { ...process.env, HARNESS_SEED: String(seed) },
    });
    if (result.status !== 0) {
      console.error(
        `::error::determinism fuzz failed seed=${seed} file=${file}`
      );
      console.error(`Replay: HARNESS_SEED=${seed} bun test ${file}`);
      recordSeeds('fuzz', {
        ...record,
        failed: { seed, file, replay: `HARNESS_SEED=${seed} bun test ${file}` },
      });
      process.exit(1);
    }
  }
  process.stdout.write('::endgroup::\n');
}

process.stdout.write(
  `determinism fuzz OK (${seeds.length} seeds × ${files.length} of ${allFiles.length} files, shard ${record.shard})\n`
);
