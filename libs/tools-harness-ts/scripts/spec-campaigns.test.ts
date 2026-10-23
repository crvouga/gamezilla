import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  campaignOwnershipProblems,
  campaignProblems,
  campaignTaskProblems,
  specCampaigns,
} from './spec-campaigns';
import { REPO_ROOT } from './spec-packages';
import { MAIN_VERIFY_TASKS } from './turbo-ci-run';
import { TASK_BUDGET_SECONDS } from './verify-budget';

describe('Quint spec campaigns', () => {
  const campaign = { dir: 'apps/product-ts', domain: 'system' };
  const scripts = {
    test: 'bun test tests/quint/simulation.test.ts tests/quint/effectiveness.test.ts',
    'test:contract': 'bun test tests/quint/model-checks.test.ts',
  };
  const inputs = [
    '$TURBO_ROOT$/specs/system/**',
    '$TURBO_ROOT$/specs/friends/**',
  ];
  const tasks = { test: { inputs }, 'test:contract': { inputs } };

  test('both Verify leaves hash the composed models and their authority', () => {
    expect(
      campaignTaskProblems({
        ...campaign,
        scripts,
        tasks,
        sources: ['specs/friends'],
      })
    ).toEqual([]);
    expect(
      campaignTaskProblems({
        ...campaign,
        scripts,
        tasks,
        sources: ['specs/friends', 'specs/profile'],
      })
    ).toEqual([
      'apps/product-ts/turbo.json: test inputs must include "$TURBO_ROOT$/specs/profile/**"',
      'apps/product-ts/turbo.json: test:contract inputs must include "$TURBO_ROOT$/specs/profile/**"',
    ]);
  });

  test('moving models cannot drop fault sensitivity or symbolic verification', () => {
    expect(
      campaignTaskProblems({
        ...campaign,
        scripts: { test: 'bun test tests/quint/simulation.test.ts' },
        tasks,
        sources: ['specs/friends'],
      })
    ).toEqual([
      'apps/product-ts/package.json: test must run tests/quint/effectiveness.test.ts',
      'apps/product-ts/package.json: test:contract must run tests/quint/model-checks.test.ts',
    ]);
  });

  test('the relocated product campaign is registered and fully cached', () => {
    const campaigns = specCampaigns(REPO_ROOT);
    expect(campaigns).toContainEqual(campaign);
    expect(campaignProblems(REPO_ROOT, campaigns)).toEqual([]);
  });

  test('a campaign cannot shadow another domain runner', () => {
    expect(
      campaignOwnershipProblems(
        [campaign],
        new Map([['system', ['apps/product-ts']]])
      )
    ).toEqual([]);
    expect(
      campaignOwnershipProblems(
        [campaign],
        new Map([['system', ['apps/product-ts', 'libs/example']]])
      )
    ).toEqual(['specs/system/: a Quint campaign must have exactly one owner']);
  });

  // regression: product-contract-outlasts-one-runner
  test('product symbolic proofs are one model per contract part', () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, 'apps/product-ts/package.json'), 'utf8')
    ) as { scripts: Record<string, string> };
    const config = readFileSync(
      join(REPO_ROOT, 'apps/product-ts/tests/quint/campaign-config.ts'),
      'utf8'
    );
    const models = [...config.matchAll(/name: '([a-z0-9-]+)'/g)].map(
      (match) => match[1]
    );
    expect(models.length).toBeGreaterThan(1);
    const parts = models.map((_, index) => `test:contract:${String(index)}`);
    expect(
      Object.keys(manifest.scripts)
        .filter((name) => /^test:contract:\d+$/.test(name))
        .sort()
    ).toEqual([...parts].sort());
    for (const [index, name] of parts.entries()) {
      const script = manifest.scripts[name];
      expect(script).toContain(
        `CONTRACT_PART=${String(index)}/${String(models.length)}`
      );
      expect(script).toContain('tests/quint/model-checks.test.ts');
      expect(MAIN_VERIFY_TASKS).toContain(name);
      expect(TASK_BUDGET_SECONDS[`@apps/product-ts#${name}`]).toBe(420);
    }
    expect(manifest.scripts['test:contract']).toBeUndefined();
    const turbo = JSON.parse(
      readFileSync(join(REPO_ROOT, 'apps/product-ts/turbo.json'), 'utf8')
    ) as { tasks: Record<string, { dependsOn?: readonly string[] }> };
    const render = turbo.tasks['test:contract:render']?.dependsOn ?? [];
    expect(render.some((dep) => dep.startsWith('test:contract'))).toBe(false);
  });
});
