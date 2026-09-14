import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { flattenCheckAggregators } from './turbo-ci-run';

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

const FAST_TIER = [
  '//#lint:biome',
  '//#lint:vocab',
  '@apps/client#check:critical-path',
  'tc',
  'test',
];

describe('turbo deploy graph invariants', () => {
  test('deploy.dependsOn never includes //#check or //#check:full', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['deploy']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).not.toContain('//#check');
    expect(deps as string[]).not.toContain('//#check:full');
    expect(deps as string[]).toContain('//#lint:biome');
    expect(deps as string[]).toContain('//#lint:eslint');
    expect(deps as string[]).toContain('//#ci:syncpack');
    expect(deps as string[]).toContain('//#ci:depcruise');
    expect(deps as string[]).toContain('//#ci:audit');
    expect(deps as string[]).toContain('//#ci:i18n');
    expect(deps as string[]).toContain('test:contract');
    expect(deps as string[]).toContain('test:e2e');
    expect(deps as string[]).toContain('@libs/billing#billing:check');
    expect(deps as string[]).toContain('@apps/server#check:api');
  });

  test('//#check is the fast tier (biome + vocab + critical-path + tc + test)', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['//#check']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toEqual(FAST_TIER);
    expect(deps as string[]).not.toContain('//#lint:eslint');
    expect(deps as string[]).not.toContain('//#ci:i18n');
  });

  test('//#check:full depends on //#check plus full leaves', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['//#check:full']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    const list = deps as string[];
    expect(list[0]).toBe('//#check');
    expect(list).toContain('//#lint:eslint');
    expect(list).toContain('//#ci:syncpack');
    expect(list).toContain('//#ci:depcruise');
    expect(list).toContain('//#ci:audit');
    expect(list).toContain('//#ci:i18n');
    expect(list).toContain('@libs/secrets#check');
    expect(list).toContain('@apps/server#build');
    expect(list).toContain('@apps/room-server#build');
    expect(list).toContain('test:contract');
    expect(list).toContain('test:e2e');
    expect(list).toContain('@libs/billing#billing:check');
    expect(list).toContain('@tools#check:static');
    expect(list).toContain('@apps/client#check:lighthouse');
    expect(list).not.toContain('@apps/server#check:api');
    expect(list).not.toContain('@apps/client#check:bundle-budget');
  });

  test('bun check invokes turbo-ci-run with check aggregator only', () => {
    const pkg = loadRootPackageJson();
    const check = pkg.scripts?.['check'];
    expect(check).toBeDefined();
    const tasks = turboCiRunTaskArgs(check ?? '');
    expect(tasks).toEqual(['check']);
    expect(tasks).not.toContain('build');
    expect(tasks).not.toContain('@apps/client#build');
    expect(tasks).not.toContain('@apps/product#build');
  });

  test('bun check:full invokes turbo-ci-run with check:full aggregator', () => {
    const pkg = loadRootPackageJson();
    const checkFull = pkg.scripts?.['check:full'];
    expect(checkFull).toBeDefined();
    const tasks = turboCiRunTaskArgs(checkFull ?? '');
    expect(tasks).toEqual(['check:full']);
  });

  test('check:full flatten is a strict superset of check', () => {
    const turbo = loadTurboJson();
    const tasks = turbo.tasks ?? {};
    const fast = flattenCheckAggregators(['check'], tasks);
    const full = flattenCheckAggregators(['check:full'], tasks);
    expect(fast).toEqual(FAST_TIER);
    for (const leaf of fast) {
      expect(full).toContain(leaf);
    }
    expect(full).toContain('@apps/server#build');
    expect(full).toContain('@apps/room-server#build');
    expect(full).not.toContain('build');
    expect(full).not.toContain('@apps/client#build');
    expect(full).not.toContain('@apps/product#build');
  });

  test('deploy gates live API probe, bundle budget, and lighthouse', () => {
    const turbo = loadTurboJson();
    const deployDeps = turbo.tasks?.deploy?.dependsOn;
    expect(Array.isArray(deployDeps)).toBe(true);
    expect(deployDeps as string[]).toContain(
      '@apps/client#check:bundle-budget'
    );
    expect(deployDeps as string[]).toContain(
      '@apps/client#check:critical-path'
    );
    expect(deployDeps as string[]).toContain('@apps/client#check:lighthouse');
    expect(deployDeps as string[]).toContain('@apps/server#check:api');
    const fullDeps = turbo.tasks?.['//#check:full']?.dependsOn;
    expect(Array.isArray(fullDeps)).toBe(true);
    expect(fullDeps as string[]).not.toContain(
      '@apps/client#check:bundle-budget'
    );
    expect(fullDeps as string[]).not.toContain('@apps/server#check:api');
    expect(fullDeps as string[]).toContain('@apps/client#check:lighthouse');
  });

  test('check:lighthouse is build-gated and not in //#check', () => {
    const turbo = loadTurboJson();
    const lh = turbo.tasks?.['@apps/client#check:lighthouse'] as
      | { dependsOn?: string[]; cache?: boolean }
      | undefined;
    expect(lh?.dependsOn).toEqual(['@apps/client#build']);
    expect(lh?.cache).toBe(false);
    const checkDeps = turbo.tasks?.['//#check']?.dependsOn as string[];
    expect(checkDeps).not.toContain('@apps/client#check:lighthouse');
    const fullDeps = turbo.tasks?.['//#check:full']?.dependsOn as string[];
    expect(fullDeps).toContain('@apps/client#check:lighthouse');
    const deployDeps = turbo.tasks?.deploy?.dependsOn as string[];
    expect(deployDeps).toContain('@apps/client#check:lighthouse');
  });

  test('smoke depends on @apps/product#deploy', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['@apps/server#smoke']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toContain('@apps/product#deploy');
    expect(deps as string[]).not.toContain('@apps/client#deploy');
  });

  test('secrets provision runs after install:cli (avoid infisical race)', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['@libs/secrets#provision']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toContain('@tools#install:cli');
  });
});
