// @io-wall-ok — explicit extended exploration, never a cached gate leaf.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { QUINT_CLI } from '@pkgs/quint-server/simulate';
import { MODEL_DIR, MODELS, REPORT_DIR } from './campaign-config';
import { sourceDigest } from './source-digest';

function requireEvaluator(): void {
  const manager = readFileSync(
    join(dirname(QUINT_CLI), 'rust/binaryManager.js'),
    'utf8'
  );
  const version = /QUINT_EVALUATOR_VERSION = '([^']+)'/.exec(manager)?.[1];
  if (!version)
    throw new Error('Cannot determine the pinned Rust evaluator version.');
  const path = join(
    process.env['QUINT_HOME'] ?? join(homedir(), '.quint'),
    `rust-evaluator-${version}`,
    process.platform === 'win32' ? 'quint_evaluator.exe' : 'quint_evaluator'
  );
  if (!existsSync(path))
    throw new Error(
      `The pinned evaluator is not installed: ${path}. This command does not download tools.`
    );
}

function expandDevices(dir: string): void {
  const path = join(dir, 'universe.qnt');
  const source = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    source
      .replace('Set(0, 1, 2, 3)', 'Set(0, 1, 2, 3, 4, 5, 6, 7)')
      .replace(
        'if (d < 2) 0 else d - 1',
        'if (d < 3) 0 else if (d < 6) 1 else 2'
      )
  );
}

async function explore(
  name: string,
  dir: string,
  seed: string,
  devices: number
): Promise<void> {
  const digest = sourceDigest(dir);
  const child = Bun.spawn(
    [
      'node',
      QUINT_CLI,
      'run',
      join(dir, `${name}.qnt`),
      '--backend',
      'rust',
      '--init',
      name === 'recovery' ? 'setup' : 'init',
      '--step',
      name === 'recovery' ? 'exploreStep' : 'step',
      '--invariant',
      'invSafety',
      '--max-samples',
      '1000',
      '--max-steps',
      '250',
      '--seed',
      seed,
      '--verbosity',
      '1',
      '--out-itf',
      join(REPORT_DIR, `${name}-${devices}-${seed}.itf.json`),
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  const timer = setTimeout(() => child.kill(), 120_000);
  const [status, out, err] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  clearTimeout(timer);
  const result = { status, output: [out, err].join('\n') };
  if (sourceDigest(dir) !== digest)
    throw new Error('Model sources changed during exploration.');
  const record = {
    model: name,
    seed,
    backend: 'rust',
    devices,
    samples: 1000,
    maxSteps: 250,
    step: name === 'recovery' ? 'exploreStep' : 'step',
    sourceSetSha256: digest,
    deviceTransform:
      devices === 8
        ? 'three devices each for people zero and one; two for person two'
        : null,
    status: result.status,
    output: result.output,
  };
  writeFileSync(
    join(REPORT_DIR, `${name}-${devices}-${seed}.exploration.json`),
    `${JSON.stringify(record, null, 2)}\n`
  );
  if (result.status !== 0 || !result.output.includes('[ok]'))
    throw new Error(result.output);
  process.stdout.write(
    `${name}: ${devices} devices, ${seed}; ${result.output.trim()}\n`
  );
}

requireEvaluator();
mkdirSync(REPORT_DIR, { recursive: true });
const expanded = mkdtempSync(join(tmpdir(), 'product-quint-eight-'));
try {
  cpSync(MODEL_DIR, expanded, { recursive: true });
  expandDevices(expanded);
  const jobs: { name: string; dir: string; seed: string; devices: number }[] =
    [];
  for (const seed of ['0x67932', '0xc0ffee', '0xdeadbeef']) {
    for (const model of MODELS)
      jobs.push({ name: model.name, dir: MODEL_DIR, seed, devices: 4 });
    for (const name of [
      'offline-replication',
      'multiplayer',
      'whole-system',
      'recovery',
    ])
      jobs.push({ name, dir: expanded, seed, devices: 8 });
  }
  async function worker(): Promise<void> {
    for (let job = jobs.shift(); job; job = jobs.shift())
      await explore(job.name, job.dir, job.seed, job.devices);
  }
  const results = await Promise.allSettled([worker(), worker()]);
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
} finally {
  rmSync(expanded, { recursive: true, force: true });
}
