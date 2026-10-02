// @io-wall-ok — opt-in real Depot benchmark; never deploys or changes infrastructure.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceFingerprint } from './check-benchmark-source';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-benchmarks');
const ORG = 'mk7ncjwh4n';
type Configuration = { shards: number; concurrency: number; cores: number };
const CONFIGURATIONS: readonly Configuration[] = [
  ...[8, 12, 16, 24, 32].map((shards) => ({
    shards,
    concurrency: 16,
    cores: 16,
  })),
  ...[12, 20, 24].map((concurrency) => ({
    shards: 16,
    concurrency,
    cores: 16,
  })),
  ...[32, 64].map((cores) => ({ shards: 16, concurrency: 16, cores })),
  ...[8, 12, 24, 32].map((shards) => ({ shards, concurrency: 16, cores: 64 })),
  ...[12, 20, 24].map((concurrency) => ({
    shards: 16,
    concurrency,
    cores: 64,
  })),
];

async function depot(args: readonly string[]): Promise<string> {
  const child = spawn('depot', ['ci', ...args, '--org', ORG], { cwd: ROOT });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const status = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
  if (status) throw new Error(`Depot ${args[0]} exited ${status}: ${stderr}`);
  return stdout;
}

async function sample(
  config: Configuration,
  mode: 'cold' | 'normal',
  index: number,
  fingerprint: string
): Promise<void> {
  if (sourceFingerprint() !== fingerprint)
    throw new Error(
      'Benchmark inputs changed; freeze source before comparing cold/warm samples'
    );
  const key = `${config.shards}-${config.cores}-${config.concurrency}-${mode}-${index}`;
  const directory = join(DIRECTORY, key);
  mkdirSync(directory, { recursive: true });
  const yaml = readFileSync(join(ROOT, '.depot/workflows/check.yml'), 'utf8')
    .replace(/CHECK_SHARDS: .*\n/, `CHECK_SHARDS: '${config.shards}'\n`)
    .replace(
      /CHECK_CONCURRENCY: .*\n/,
      `CHECK_CONCURRENCY: '${config.concurrency}'\n`
    )
    .replace(/CHECK_CACHE_MODE: .*\n/, `CHECK_CACHE_MODE: ${mode}\n`)
    .replace(
      /shard: \$\{\{.*\n/,
      `shard: [${Array.from({ length: config.shards }, (_, index) => index).join(', ')}]\n`
    )
    .replace(
      /runs-on: \$\{\{ inputs.runner .*\n/,
      `runs-on: depot-ubuntu-24.04-${config.cores}\n`
    )
    .replace(/group: check-.*\n/, `group: check-benchmark-${key}\n`);
  const path = join(directory, 'check.yml');
  writeFileSync(path, yaml);
  const launched = process.hrtime.bigint();
  const startedAt = new Date().toISOString();
  const output = await depot([
    'run',
    '--repo',
    'gamezilla-org/gamezilla',
    '--workflow',
    path,
  ]);
  const runId = /^Run: (\S+)/m.exec(output)?.[1];
  if (!runId) throw new Error('Depot did not return a run ID');
  writeFileSync(
    join(directory, 'launch.json'),
    JSON.stringify({
      ...config,
      mode,
      index,
      runId,
      startedAt,
      sourceFingerprint: fingerprint,
    })
  );
  console.log(`benchmark ${key}: ${runId}`);
  await awaitGate(runId, directory, launched);
}

async function awaitGate(
  runId: string,
  directory: string,
  launched: bigint
): Promise<void> {
  for (let poll = 0; poll < 600; poll++) {
    const json = await depot(['status', runId, '-o', 'json']);
    const state = JSON.parse(json) as {
      workflows: {
        jobs: { job_id: string; job_display_name: string; status: string }[];
      }[];
    };
    const jobs = state.workflows[0]?.jobs ?? [];
    const gate = jobs.find((job) => job.job_display_name === 'check');
    if (gate && ['finished', 'failed', 'cancelled'].includes(gate.status)) {
      writeFileSync(join(directory, 'status.json'), json);
      writeFileSync(
        join(directory, 'metrics.json'),
        await depot(['metrics', '--run', runId, '-o', 'json'])
      );
      const wallMs = Number(process.hrtime.bigint() - launched) / 1e6;
      writeFileSync(
        join(directory, 'verdict.json'),
        JSON.stringify({ runId, verdict: gate.status, wallMs })
      );
      await Promise.all(
        jobs
          .filter((job) => job.job_display_name !== 'check:reports')
          .map(async (job) => {
            const log = await depot(['logs', job.job_id, '--timestamps']);
            const name = job.job_display_name.replace(/[^a-z0-9-]/g, '-');
            writeFileSync(join(directory, `${name}.log`), log);
          })
      );
      console.log(
        `benchmark ${runId}: ${gate.status}, observed ${(wallMs / 1000).toFixed(3)}s (includes CLI submission and <=2s observation delay)`
      );
      if (gate.status !== 'finished')
        console.warn(
          `Required gate remains ${gate.status}: ${runId}; recording latency, not a successful release`
        );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Benchmark gate deadline: ${runId}`);
}

if (import.meta.main) {
  if (process.argv[2] !== '--execute')
    throw new Error(
      'Usage: check-benchmark.ts --execute [samples=3] [shards or shards-cores-concurrency]'
    );
  const count = Number(process.argv[3] ?? '3');
  if (!Number.isSafeInteger(count) || count < 3)
    throw new Error('Use at least three samples');
  const selected = process.argv[4];
  const fingerprint = sourceFingerprint();
  for (const config of CONFIGURATIONS.filter(
    (config) =>
      !selected ||
      config.shards === Number(selected) ||
      `${config.shards}-${config.cores}-${config.concurrency}` === selected
  ))
    for (let index = 0; index < count; index++) {
      await sample(config, 'cold', index, fingerprint);
      await sample(config, 'normal', index, fingerprint);
    }
}
