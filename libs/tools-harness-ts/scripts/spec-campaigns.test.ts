import { describe, expect, test } from 'bun:test';
import {
  campaignOwnershipProblems,
  campaignTaskProblems,
} from './spec-campaigns';

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
});
