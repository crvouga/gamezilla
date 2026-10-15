import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  packageScriptViolations,
  ROOT_TERMINAL_COMMANDS,
  rootScriptViolations,
  type TurboTasks,
  taskCachingViolations,
} from './task-runner-policy';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function json<T>(path: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')) as T;
}

const TOOL = { cache: false } as const;

describe('root scripts', () => {
  const tasks: TurboTasks = {
    '//#task:report': TOOL,
    '//#ci:audit': { inputs: [], outputs: [] },
    '//#check': { outputs: [] },
    '@libs/runtime-server#migrate': TOOL,
    lint: { inputs: [], outputs: [] },
  };
  const root = (scripts: Record<string, string>) =>
    rootScriptViolations({
      scripts: { ...ROOT_SCRIPTS, ...scripts },
      tasks,
    });
  const ROOT_SCRIPTS = Object.fromEntries(
    Object.keys(ROOT_TERMINAL_COMMANDS).map((name) => [name, `bun ${name}.ts`])
  );

  test('a command is a Turborepo run of its own task', () => {
    expect(
      root({
        report: 'turbo run //#task:report --',
        'task:report': 'bun run libs/tools/scripts/report.ts',
        'ci:audit': 'bun run libs/tools/scripts/ci-audit.ts',
        'db:migrate':
          'SECRETS_ENV=dev bun run libs/secrets-server/scripts/secrets-run.ts -- turbo run @libs/runtime-server#migrate --only --',
        lint: 'bun run libs/tools/scripts/turbo-ci-run.ts lint //#lint:root',
        check: 'bun run lint',
      })
    ).toEqual([]);
  });

  test('a command that runs its program directly is refused', () => {
    expect(root({ report: 'bun run libs/tools/scripts/report.ts' })).toEqual([
      expect.stringContaining('`report` runs outside Turborepo'),
    ]);
  });

  test('a launcher names tasks turbo.json declares', () => {
    expect(root({ report: 'turbo run //#task:missing --' })).toEqual([
      expect.stringContaining('which turbo.json does not declare'),
    ]);
  });

  test('a launcher is one turbo run, not a chain', () => {
    const [violation] = root({
      report: 'turbo run //#task:report && turbo run lint',
      'task:report': 'bun run libs/tools/scripts/report.ts',
    });
    expect(violation).toContain('chains commands around turbo');
  });

  test("a command's body has a launcher that runs it", () => {
    expect(
      root({ 'task:report': 'bun run libs/tools/scripts/report.ts' })
    ).toEqual([
      expect.stringContaining('`report` does not run `//#task:report`'),
    ]);
  });

  test('an alias never reaches past turbo to a task body', () => {
    expect(
      root({
        audit: 'bun run ci:audit',
        'ci:audit': 'bun run libs/tools/scripts/ci-audit.ts',
      })
    ).toEqual([expect.stringContaining('runs the task body `ci:audit`')]);
  });

  test('a stale terminal exception is refused', () => {
    expect(rootScriptViolations({ scripts: {}, tasks })).toHaveLength(
      Object.keys(ROOT_TERMINAL_COMMANDS).length
    );
  });
});

describe('package scripts', () => {
  const pkg = (scripts: Record<string, string>) =>
    packageScriptViolations({ pkg: 'libs/example', scripts });

  test('a script body is one task', () => {
    expect(
      pkg({
        build: 'vite build && bun run scripts/build-sw.ts',
        test: 'bun test tests/a.test.ts',
        lint: 'bun run ../../libs/tools/scripts/lint-package.ts',
      })
    ).toEqual([]);
  });

  test('a script never runs another script', () => {
    expect(pkg({ build: 'vite build', start: 'bun run build' })).toEqual([
      expect.stringContaining('`start` runs the script `build`'),
    ]);
    expect(pkg({ build: 'bun run --cwd ../.. i18n:compile' })).toEqual([
      expect.stringContaining('another package'),
    ]);
    expect(pkg({ build: 'bun run --filter @libs/other build' })).toEqual([
      expect.stringContaining('another package'),
    ]);
  });

  test('a package-manager hook is not a dependency', () => {
    expect(pkg({ prebuild: 'echo', build: 'vite build' })).toEqual([
      expect.stringContaining('`prebuild` runs around `build`'),
    ]);
    expect(pkg({ prepack: 'bun run scripts/build.ts' })).toEqual([]);
  });

  test('processes side by side are tasks, not background jobs', () => {
    expect(pkg({ dev: 'vite & bun run scripts/api.ts & wait' })).toEqual([
      expect.stringContaining('backgrounds a process'),
    ]);
    expect(pkg({ dev: 'vite > out.log 2>&1' })).toEqual([]);
  });

  test('only the root starts turbo', () => {
    expect(pkg({ check: 'turbo run lint' })).toEqual([
      expect.stringContaining('starts turbo'),
    ]);
  });
});

describe('task caching', () => {
  test('a task is cached on purpose or not at all', () => {
    expect(
      taskCachingViolations({
        '//#task:report': { cache: false },
        '//#task:i18n:compile': { inputs: ['a.po'], outputs: ['a.ts'] },
        '//#check': { outputs: [] },
      })
    ).toEqual([]);
    expect(taskCachingViolations({ build: { outputs: ['dist/**'] } })).toEqual([
      expect.stringContaining('`build` is cached without declaring its inputs'),
    ]);
    expect(taskCachingViolations({ build: {} })).toEqual([
      expect.stringContaining('inputs and outputs'),
    ]);
  });
});

describe('this repository', () => {
  const tasks = json<{ tasks: TurboTasks }>('turbo.json').tasks;
  const scripts = json<{ scripts: Record<string, string> }>(
    'package.json'
  ).scripts;

  test('every root command goes through Turborepo', () => {
    expect(rootScriptViolations({ scripts, tasks })).toEqual([]);
    expect(taskCachingViolations(tasks)).toEqual([]);
  });

  test('no package script runs another script', () => {
    const violations = ['apps', 'libs', 'pkgs'].flatMap((tier) =>
      readdirSync(join(REPO_ROOT, tier)).flatMap((dir) => {
        const manifest = `${tier}/${dir}/package.json`;
        if (!existsSync(join(REPO_ROOT, manifest))) return [];
        return packageScriptViolations({
          pkg: `${tier}/${dir}`,
          scripts:
            json<{ scripts?: Record<string, string> }>(manifest).scripts ?? {},
        }).map((violation) => `${tier}/${dir}: ${violation}`);
      })
    );
    expect(violations).toEqual([]);
  });

  test('files generated at install are cached by what they are made from', () => {
    expect(scripts['generate']).toBe(
      'turbo run @pkgs/object-store-s3-server#generate:browser @libs/infra-shared#generate:infra-map //#task:i18n:compile //#task:spec:catalog //#task:spec:inputs'
    );
    for (const id of [
      '@pkgs/object-store-s3-server#generate:browser',
      '@libs/infra-shared#generate:infra-map',
      '//#task:i18n:compile',
      '//#task:spec:catalog',
      '//#task:spec:inputs',
    ]) {
      expect(tasks[id]?.cache).toBeUndefined();
      expect(tasks[id]?.inputs?.length).toBeGreaterThan(0);
      expect(tasks[id]?.outputs?.length).toBeGreaterThan(0);
    }
  });
});
