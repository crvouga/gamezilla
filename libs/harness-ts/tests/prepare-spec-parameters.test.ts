import { expect, test } from 'bun:test';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodeItfTrace } from '@pkgs/quint-shared-ts/itf';

const ROOT = resolve(import.meta.dir, '../../..');
const CLI = join(ROOT, 'libs/harness-ts/scripts/prepare-spec.ts');

async function prepare(dir: string, path: string): Promise<string> {
  const child = Bun.spawn(
    [
      process.execPath,
      CLI,
      '--draw',
      JSON.stringify([{ path, traces: 1, maxSteps: 0 }]),
    ],
    {
      cwd: dir,
      env: {
        ...process.env,
        PBT_RANDOM: '0',
        FC_SEED: '424242',
        HARNESS_REPORT_DIR: join(dir, '.cache/harness-report/prepared'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0)
    throw new Error(`preparation exited ${code}: ${stderr}${stdout}`);
  return join(dir, '.cache/prepared-spec-traces');
}

function initialState(dir: string) {
  const files = readdirSync(dir).filter((file) => file.endsWith('.itf.json'));
  expect(files).toHaveLength(1);
  const trace = decodeItfTrace(
    JSON.parse(readFileSync(join(dir, files[0]!), 'utf8'))
  );
  expect(trace.states).toHaveLength(1);
  return trace.states[0]!.vars;
}

// regression: quint-preparation-unbound-constants
test.each(['puzzle-attempt', 'puzzle-sound'])(
  'CI preparation closes both OPPONENT assignments of %s',
  async (model) => {
    const dir = mkdtempSync(join(tmpdir(), 'prepare-puzzle-model-'));
    try {
      const output = await prepare(
        dir,
        join(ROOT, 'specs/games', `${model}.qnt`)
      );
      const drawn = join(output, model);
      expect(readdirSync(drawn).sort()).toEqual([
        'OPPONENT=false',
        'OPPONENT=true',
      ]);
      for (const value of [false, true])
        expect(
          Object.keys(initialState(join(drawn, `OPPONENT=${value}`))).length
        ).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30_000
);

test('preparation retains both fixed Boolean values', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'prepare-fixed-model-'));
  try {
    const path = join(dir, 'fixed-flag.qnt');
    writeFileSync(
      path,
      'module fixed_flag { const FLAG: bool\nvar flag: bool\naction init = flag\x27 = FLAG\naction step = flag\x27 = flag\nval invKnown = flag == true or flag == false }'
    );
    const output = await prepare(dir, path);
    for (const value of [false, true])
      expect(
        initialState(join(output, 'fixed-flag', `FLAG=${value}`))['flag']
      ).toBe(value);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30_000);

test('preparation keeps an unparameterized draw at its existing path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'prepare-plain-model-'));
  try {
    const path = join(dir, 'plain-counter.qnt');
    writeFileSync(
      path,
      'module plain_counter { var count: int\naction init = count\x27 = 0\naction step = count\x27 = count\nval invZero = count == 0 }'
    );
    const output = await prepare(dir, path);
    expect(initialState(join(output, 'plain-counter'))['count']).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30_000);
