// @io-wall-ok — native timing reader; no environment values are serialized.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NativeTiming } from './check-benchmark-measure';
import { measureCheck, measureShardLog } from './check-benchmark-measure';
import { distribution } from './check-benchmark-stats';
import { imbalance } from './check-shards';

const directory = process.argv[2] ?? '.cache/check-benchmarks';
const samples = readdirSync(directory).flatMap((name) => {
  const path = join(directory, name);
  if (!existsSync(join(path, 'verdict.json'))) return [];
  const launch = JSON.parse(
    readFileSync(join(path, 'launch.json'), 'utf8')
  ) as {
    runId: string;
    shards: number;
    cores: number;
    concurrency: number;
    mode: string;
    sourceFingerprint: string;
  };
  const verdict = JSON.parse(
    readFileSync(join(path, 'verdict.json'), 'utf8')
  ) as { verdict: string; wallMs: number };
  const metricFile = join(path, 'metrics.json');
  if (!existsSync(metricFile) || process.argv.includes('--refresh'))
    writeFileSync(
      metricFile,
      execFileSync('depot', [
        'ci',
        'metrics',
        '--run',
        launch.runId,
        '--org',
        'mk7ncjwh4n',
        '-o',
        'json',
      ])
    );
  const measured = measureCheck(
    JSON.parse(readFileSync(metricFile, 'utf8')) as NativeTiming,
    launch.cores
  );
  const shards = readdirSync(path)
    .filter((file) => file.startsWith('check-shards') && file.endsWith('.log'))
    .map((file) => measureShardLog(readFileSync(join(path, file), 'utf8')));
  if (shards.length !== launch.shards)
    throw new Error(`Incomplete shard evidence: ${name}`);
  const hits = shards.reduce((sum, shard) => sum + shard.hits, 0);
  const tasks = shards.reduce((sum, shard) => sum + shard.tasks, 0);
  return [
    {
      ...launch,
      ...verdict,
      ...measured,
      totalCoreSeconds:
        measured.reportSeconds === null
          ? null
          : measured.requiredCoreSeconds + measured.reportSeconds * 16,
      shards,
      hits,
      tasks,
      slowestShardSeconds: Math.max(
        ...shards.map((shard) => shard.actualSeconds)
      ),
      imbalance: imbalance(shards.map((shard) => shard.actualSeconds)),
    },
  ];
});
const groups = new Map<string, typeof samples>();
for (const sample of samples) {
  const key = `${sample.shards.length}-${sample.cores}-${sample.concurrency}-${sample.mode}`;
  groups.set(key, [...(groups.get(key) ?? []), sample]);
}
const configurations = [...groups].map(([key, rows]) => ({
  key,
  fingerprints: [...new Set(rows.map((row) => row.sourceFingerprint))],
  passed: rows.filter((row) => row.verdict === 'finished').length,
  samples: rows.length,
  gate: distribution(rows.map((row) => row.gateSeconds)),
  slowestShard: distribution(rows.map((row) => row.slowestShardSeconds)),
  hitRate: distribution(rows.map((row) => row.hits / row.tasks)),
  coreSeconds: distribution(rows.map((row) => row.requiredCoreSeconds)),
  totalCoreSeconds: rows.every((row) => row.totalCoreSeconds !== null)
    ? distribution(rows.map((row) => row.totalCoreSeconds!))
    : null,
}));
const report = { samples, configurations };
writeFileSync(
  join(directory, 'measurements.json'),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(configurations, null, 2));
