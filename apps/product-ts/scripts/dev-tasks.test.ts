import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SERVICE_NAMES } from './stack-services';

const REPO_ROOT = join(import.meta.dirname, '../../..');

type Task = {
  readonly dependsOn?: readonly string[];
  readonly with?: readonly string[];
  readonly persistent?: boolean;
  readonly cache?: boolean;
};

function json<T>(path: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')) as T;
}

const tasks = json<{ tasks: Record<string, Task> }>('turbo.json').tasks;
const scripts = json<{ scripts: Record<string, string> }>(
  'apps/product-ts/package.json'
).scripts;

describe('bun dev tasks', () => {
  test('every process of the stack is its own persistent Turborepo task', () => {
    for (const name of SERVICE_NAMES) {
      expect(scripts[`dev:${name}`]).toBe(
        `bun run scripts/dev-service.ts ${name}`
      );
      expect(tasks[`@apps/product-ts#dev:${name}`]).toEqual({
        dependsOn: ['dev:prepare'],
        persistent: true,
        cache: false,
      });
    }
  });

  test('the dev task runs alongside every service of the stack', () => {
    const dev = tasks['@apps/product-ts#dev'];
    expect(scripts['dev']).toBe('bun run scripts/dev-service.ts ready');
    expect(dev?.persistent).toBe(true);
    expect(dev?.dependsOn).toEqual(['dev:prepare']);
    expect([...(dev?.with ?? [])].sort()).toEqual(
      [
        ...SERVICE_NAMES.map((name) => `dev:${name}`),
        '@pkgs/ui-root-harness-ts#dev:storybook',
      ].sort()
    );
  });

  test('bun dev is one Turborepo run of the dev task', () => {
    const launcher = readFileSync(
      join(REPO_ROOT, 'apps/product-ts/scripts/dev-run.ts'),
      'utf8'
    );
    expect(
      json<{ scripts: Record<string, string> }>('package.json').scripts
    ).toMatchObject({ dev: 'bun run apps/product-ts/scripts/dev-run.ts' });
    expect(launcher).toContain("'node_modules/.bin/turbo'");
    expect(launcher).toContain("'@apps/product-ts#dev'");
    // regression: workspace-reuses-dead-web-boot
    expect(launcher).toContain("'--continue=never'");
    expect(launcher).not.toMatch(
      /'--continue(?:=always|=dependencies-successful)?'/
    );
  });

  // regression: workspace-run-stale-install
  test('the stack is planned only after the install and merge checks', () => {
    expect(tasks['@apps/product-ts#dev:prepare']?.dependsOn).toEqual([
      '//#workspace:install',
      '//#workspace:merge',
    ]);
    const root = json<{ scripts: Record<string, string> }>('package.json');
    for (const step of ['install', 'merge'])
      expect(root.scripts[`workspace:${step}`]).toBe(
        `./libs/tools-harness-ts/workspace/step.sh ${step}`
      );
  });

  test('task output goes to the terminal UI', () => {
    expect(json<{ ui: string }>('turbo.json').ui).toBe('tui');
  });
});
