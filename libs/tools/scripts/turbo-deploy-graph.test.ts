import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { flattenCheckAggregators } from './turbo-ci-run';

const REPO_ROOT = join(import.meta.dirname, '../../..');

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

/** `//#check` is the whole check surface — there is no second tier. */
const CHECK_LEAVES = [
  '//#ci:agent-commands',
  '//#ci:goals',
  '//#ci:no-skipped-tests',
  '//#lint:naming',
  '//#lint:biome',
  '//#lint:eslint',
  '//#ci:syncpack',
  '//#ci:depcruise',
  '//#ci:audit',
  '//#ci:i18n',
  '@apps/client#check:critical-path',
  '@apps/client#check:bundle-budget',
  'tc',
  'test',
  '@apps/server#build',
  '@apps/room-server#build',
  '@pkgs/sql-client-postgres#test:contract',
  '@pkgs/db-schema-postgres#test:contract',
  '@pkgs/db-indexes-postgres#test:contract',
  '@pkgs/kv-postgres#test:contract',
  '@pkgs/object-store-s3#test:contract',
  '@pkgs/pubsub-emqx#test:contract',
  '@libs/billing#billing:check',
  '@apps/server#check:contract',
  '@apps/server#check:api',
  '@libs/runtime#check:schema-evolution',
  '@libs/secrets#check',
  '@libs/tools#check:static',
];

/** Deploy mutates shared envs; smoke is the only deploy-only leaf. */
const DEPLOY_ONLY = ['@apps/server#smoke'] as const;

describe('turbo check/deploy graph invariants', () => {
  test('//#check is the whole check suite and //#check:full is gone', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['//#check']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toEqual(CHECK_LEAVES);
    expect(turbo.tasks?.['//#check:full']).toBeUndefined();
    for (const leaf of DEPLOY_ONLY) {
      expect(deps as string[]).not.toContain(leaf);
    }
    expect(deps as string[]).not.toContain('test:contract');
    expect(deps as string[]).not.toContain('build');
    expect(deps as string[]).not.toContain('@apps/client#build');
    expect(deps as string[]).not.toContain('@apps/product#build');
  });

  // goal:the-bar:1 — every check that gates a release also gates a PR merge.
  test('//#deploy adds only DEPLOY_ONLY leaves on top of //#check', () => {
    const turbo = loadTurboJson();
    const check = new Set(turbo.tasks?.['//#check']?.dependsOn as string[]);
    const deploy = turbo.tasks?.['//#deploy']?.dependsOn as string[];
    expect(deploy.filter((dep) => !check.has(dep))).toEqual([...DEPLOY_ONLY]);
  });

  test('//#deploy.dependsOn never includes //#check', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['//#deploy']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).not.toContain('//#check');
    expect(deps as string[]).toContain('//#lint:biome');
    expect(deps as string[]).toContain('//#lint:eslint');
    expect(deps as string[]).toContain('//#ci:syncpack');
    expect(deps as string[]).toContain('//#ci:goals');
    expect(deps as string[]).toContain('//#ci:agent-commands');
    expect(deps as string[]).toContain('//#ci:depcruise');
    expect(deps as string[]).toContain('//#ci:audit');
    expect(deps as string[]).toContain('//#ci:i18n');
    expect(deps as string[]).toContain('//#ci:no-skipped-tests');
    for (const leaf of DEPLOY_ONLY) {
      expect(deps as string[]).toContain(leaf);
    }
    expect(deps as string[]).not.toContain('test:contract');
    expect(deps as string[]).toContain('@libs/billing#billing:check');
    expect(turbo.tasks?.['deploy']).toBeUndefined();
  });

  test('bun check invokes turbo-ci-run with the check aggregator only', () => {
    const pkg = loadRootPackageJson();
    const check = pkg.scripts?.['check'];
    expect(check).toBeDefined();
    const tasks = turboCiRunTaskArgs(check ?? '');
    expect(tasks).toEqual(['check']);
    expect(tasks).not.toContain('build');
    expect(tasks).not.toContain('@apps/client#build');
    expect(tasks).not.toContain('@apps/product#build');
    expect(pkg.scripts?.['check:full']).toBeUndefined();
  });

  test('bun deploy invokes turbo-ci-run with //#deploy', () => {
    const pkg = loadRootPackageJson();
    const deploy = pkg.scripts?.['deploy'];
    expect(deploy).toBeDefined();
    const tasks = turboCiRunTaskArgs(deploy ?? '');
    expect(tasks).toEqual(['//#deploy']);
  });

  test('check flattens to the full suite (no client/product build)', () => {
    const turbo = loadTurboJson();
    const leaves = flattenCheckAggregators(['check'], turbo.tasks ?? {});
    expect(leaves).toEqual(CHECK_LEAVES);
    expect(leaves).toContain('@apps/server#build');
    expect(leaves).toContain('@apps/room-server#build');
    expect(leaves).not.toContain('build');
    expect(leaves).not.toContain('@apps/client#build');
    expect(leaves).not.toContain('@apps/product#build');
    expect(leaves).not.toContain('//#check');
  });

  test('check gates live API probe and bundle budget; deploy adds smoke only', () => {
    const turbo = loadTurboJson();
    const checkDeps = turbo.tasks?.['//#check']?.dependsOn as string[];
    expect(checkDeps).toContain('@apps/client#check:bundle-budget');
    expect(checkDeps).toContain('@apps/client#check:critical-path');
    expect(checkDeps).toContain('@apps/server#check:api');
    expect(checkDeps).not.toContain('@apps/server#smoke');
    const deployDeps = turbo.tasks?.['//#deploy']?.dependsOn;
    expect(Array.isArray(deployDeps)).toBe(true);
    expect(deployDeps as string[]).toContain(
      '@apps/client#check:critical-path'
    );
    expect(deployDeps as string[]).toContain('@apps/server#smoke');
  });

  test('smoke depends on @apps/product#deploy and is scheduled by //#deploy', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['@apps/server#smoke']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toContain('@apps/product#deploy');
    expect(deps as string[]).not.toContain('@apps/client#deploy');
    const deployDeps = turbo.tasks?.['//#deploy']?.dependsOn as string[];
    expect(deployDeps).toContain('@apps/server#smoke');
  });

  test('deploy flatten includes smoke', () => {
    const turbo = loadTurboJson();
    const leaves = flattenCheckAggregators(['deploy'], turbo.tasks ?? {});
    expect(leaves).toContain('@apps/server#smoke');
    expect(leaves).not.toContain('//#deploy');
  });

  test('secrets provision runs after install:cli (avoid infisical race)', () => {
    const turbo = loadTurboJson();
    const deps = turbo.tasks?.['@libs/secrets#provision']?.dependsOn;
    expect(Array.isArray(deps)).toBe(true);
    expect(deps as string[]).toContain('@libs/tools#install:cli');
  });
});
