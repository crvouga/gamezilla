import { describe, expect, test } from 'bun:test';
import {
  campaignOwnershipProblems,
  campaignProblems,
  campaignTaskProblems,
  specCampaigns,
} from './spec-campaigns';
import { REPO_ROOT } from './spec-packages';

describe('Quint spec campaigns', () => {
  const campaign = { dir: 'apps/product', domain: 'system' };
  const scripts = {
    test: 'bun test tests/quint/simulation.test.ts tests/quint/effectiveness.test.ts',
    'test:contract': 'bun test tests/quint/model-checks.test.ts',
  };
  const inputs = [
    '$TURBO_ROOT$/specs/system/**',
    '$TURBO_ROOT$/specs/friends/**',
  ];
  const tasks = { test: { inputs }, 'test:contract': { inputs } };

  test('both Check leaves hash the composed models and their authority', () => {
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
      'apps/product/turbo.json: test inputs must include "$TURBO_ROOT$/specs/profile/**"',
      'apps/product/turbo.json: test:contract inputs must include "$TURBO_ROOT$/specs/profile/**"',
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
      'apps/product/package.json: test must run tests/quint/effectiveness.test.ts',
      'apps/product/package.json: test:contract must run tests/quint/model-checks.test.ts',
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
        new Map([['system', ['apps/product']]])
      )
    ).toEqual([]);
    expect(
      campaignOwnershipProblems(
        [campaign],
        new Map([['system', ['apps/product', 'libs/example']]])
      )
    ).toEqual(['specs/system/: a Quint campaign must have exactly one owner']);
  });
});
