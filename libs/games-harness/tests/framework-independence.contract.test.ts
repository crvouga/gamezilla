import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import { stubSource } from '@pkgs/gherkin-shared/stubs';

const PACKAGE = join(import.meta.dir, '..');
const ROOT = join(PACKAGE, '../..');
const PRELOAD = join(import.meta.dir, 'independence/test-only-composition.ts');
const PRELOADS = [
  '--conditions=browser',
  '--conditions=development',
  '--preload',
  PRELOAD,
  '--preload',
  '@pkgs/bun-test-solid-client/preload',
  '--preload',
  '@libs/harness/preload',
];

async function execute(args: readonly string[]) {
  const {
    HARNESS_REPORT_DIR: _reports,
    OBS_TRACE_ARTIFACT_DIR: _traces,
    ...env
  } = process.env;
  const child = Bun.spawn([process.execPath, ...args], {
    cwd: PACKAGE,
    stdout: 'pipe',
    stderr: 'pipe',
    env,
    timeout: 150_000,
    killSignal: 'SIGKILL',
  });
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { code, output: stdout + stderr };
  } finally {
    child.kill();
    await child.exited;
  }
}

function sharedFeature(directory: string, name: string): string {
  const featureUri = `specs/games/${name}.feature`;
  const path = join(directory, `${name}.test.ts`);
  writeFileSync(
    path,
    stubSource({
      packageName: '@libs/games-harness',
      featurePath: join(ROOT, featureUri),
      featureUri,
      stepsEntry: join(import.meta.dir, 'steps/index.ts'),
      bridge: '@pkgs/gherkin-server/bun-test',
    })
  );
  return path;
}

function assertIndependent(
  result: Awaited<ReturnType<typeof execute>>,
  names: readonly string[]
): void {
  expect(result.code, result.output).toBe(0);
  for (const name of names) expect(result.output).toContain(name);
  expect(result.output).toContain('0 fail');
  const checks = /^\s*(\d+) pass\s*\n\s*0 fail/m.exec(result.output);
  expect(checks).not.toBeNull();
  process.stdout.write(
    `framework independence: ${checks?.[1]} checks passed in the test-only composition\n`
  );
  for (const game of HARNESS_GAMES) {
    expect(result.output).not.toContain(`${game.label} ›`);
    expect(result.output).not.toContain(`[${game.label}]`);
  }
}

// regression: isolated-framework-combined-run-timeout
test('shared client/server suites execute with only independent test consumers', async () => {
  const result = await execute([
    'test',
    ...PRELOADS,
    '--timeout',
    '240000',
    'tests/conformance',
    'tests/game-conformance-matrix.test.ts',
    'tests/reference-game',
  ]);
  assertIndependent(result, [
    'setup race › rules',
    'counting race › rules',
    'solo count › rules',
    'solo count › puzzles',
  ]);
}, 180_000);

test.each(['custom-games', 'game-turns'])(
  '%s executes with only independent test consumers',
  async (name) => {
    const cache = join(PACKAGE, '.cache');
    mkdirSync(cache, { recursive: true });
    const directory = mkdtempSync(join(cache, 'independence-'));
    try {
      const result = await execute([
        'test',
        ...PRELOADS,
        // The same scenario timeout used by the repository's spec runner.
        '--timeout',
        '240000',
        sharedFeature(directory, name),
      ]);
      assertIndependent(result, ['[setup race]', '[counting race]']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  180_000
);

test('isolation rejects a hidden concrete-game source before loading it', async () => {
  const manifests = [
    ...new Bun.Glob('libs/*/package.json').scanSync(ROOT),
  ].sort();
  const file = manifests.find(
    (path) =>
      (
        JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as {
          readonly game?: string;
        }
      ).game !== undefined
  );
  expect(file).toBeDefined();
  const source = [
    ...new Bun.Glob('src/*.ts').scanSync(join(ROOT, file!, '..')),
  ].find((path) => !path.endsWith('.d.ts'));
  expect(source).toBeDefined();
  const entry = join(ROOT, file!, '..', source!);
  const result = await execute([
    '--preload',
    PRELOAD,
    '-e',
    `await import(${JSON.stringify(entry)})`,
  ]);
  expect(result.code).not.toBe(0);
  expect(result.output).toContain('ISOLATION_BLOCKED_GAME:');
});
