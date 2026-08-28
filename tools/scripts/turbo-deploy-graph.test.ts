import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

function loadTurboJson(): { tasks?: Record<string, { dependsOn?: unknown }> } {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')) as {
    tasks?: Record<string, { dependsOn?: unknown }>;
  };
}

function loadRootPackageJson(): { scripts?: Record<string, string> } {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
}

function turboCiRunTaskArgs(checkScript: string): string[] {
  const marker = 'turbo-ci-run.ts';
  const idx = checkScript.indexOf(marker);
  expect(idx).toBeGreaterThanOrEqual(0);
  return checkScript
    .slice(idx + marker.length)
    .trim()
    .split(/\s+/);
}

describe('turbo deploy graph invariants', () => {
  test('deploy.dependsOn never includes //#check (re-enters bun check)', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['deploy']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).not.toContain('//#check');
    expect(deps as string[]).toContain('//#ci:syncpack');
    expect(deps as string[]).toContain('//#ci:depcruise');
    expect(deps as string[]).toContain('//#ci:audit');
  });

  test('bun check never runs unscoped build or @apps/client#build', () => {
    const pkg = loadRootPackageJson();
    const check = pkg.scripts?.['check'];
    expect(check).toBeDefined();
    const tasks = turboCiRunTaskArgs(check ?? '');
    expect(tasks).not.toContain('build');
    expect(tasks).not.toContain('@apps/client#build');
    expect(tasks).not.toContain('@sim/console#build');
    expect(tasks).toContain('@apps/server#build');
    expect(tasks).toContain('@apps/room-server#build');
  });

  test('smoke depends on @sim/console#deploy', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['@apps/server#smoke']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toContain('@sim/console#deploy');
    expect(deps as string[]).toContain('@apps/client#deploy');
  });

  test('secrets provision runs after install:cli (avoid infisical race)', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['@libs/secrets#provision']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toContain('@tools#install:cli');
  });
});
