import { describe, expect, test } from 'bun:test';
import { gaps, overlaps } from '@pkgs/dmn-shared/analyze';
import { generateCases } from '@pkgs/dmn-shared/cases';
import { evaluateDecision } from '@pkgs/dmn-shared/evaluate';
import { inputClasses } from '@pkgs/dmn-shared/partition';
import type { TableSpec } from './fixtures/table';
import { decisionOf } from './fixtures/table';

const TIER = {
  name: 'tier',
  typeRef: 'string',
  values: '"guest","free","plus"',
};
const PLAYS = { name: 'plays today', typeRef: 'number', values: '[0..1000]' };
const DECISION = {
  name: 'decision',
  typeRef: 'string',
  values: '"allow","deny"',
};

const complete: TableSpec = {
  inputs: [TIER, PLAYS],
  outputs: [DECISION],
  rules: [
    { id: 'below', in: ['"guest","free"', '< 20'], out: ['"allow"'] },
    { id: 'at', in: ['"guest","free"', '>= 20'], out: ['"deny"'] },
    { id: 'plus', in: ['"plus"', '-'], out: ['"allow"'] },
  ],
};

describe('completeness', () => {
  test('a table covering every combination has no gaps', () => {
    expect(gaps(decisionOf(complete))).toEqual([]);
  });

  test('a seeded gap is found with a concrete witness', () => {
    // The limit rule was written `> 20`: exactly 20 plays has no answer.
    const seeded = decisionOf({
      ...complete,
      rules: complete.rules.map((r) =>
        r.id === 'at' ? { ...r, in: ['"guest","free"', '> 20'] } : r
      ),
    });
    const found = gaps(seeded);
    expect(found).toEqual([
      {
        input: { tier: 'guest', 'plays today': 20 },
        region: { tier: '"guest"', 'plays today': '20' },
      },
      {
        input: { tier: 'free', 'plays today': 20 },
        region: { tier: '"free"', 'plays today': '20' },
      },
    ]);
    for (const gap of found) {
      expect(evaluateDecision(seeded, gap.input)).toMatchObject({
        ok: false,
        error: expect.stringContaining('no rule answers'),
      });
    }
  });

  test('a whole missing branch is one gap, with "-" for inputs that do not matter', () => {
    const noPlus = decisionOf({
      ...complete,
      rules: complete.rules.slice(0, 2),
    });
    expect(gaps(noPlus)).toEqual([
      {
        input: { tier: 'plus', 'plays today': 0 },
        region: { tier: '"plus"', 'plays today': '-' },
      },
    ]);
  });
});

describe('consistency', () => {
  test('a seeded overlap is found with the rules that collide', () => {
    // The limit rule was written `>= 19`: 19 plays is both allowed and denied.
    const seeded = decisionOf({
      ...complete,
      rules: complete.rules.map((r) =>
        r.id === 'at' ? { ...r, in: ['"guest","free"', '>= 19'] } : r
      ),
    });
    const found = overlaps(seeded);
    expect(found).toEqual([
      {
        input: { tier: 'guest', 'plays today': 19 },
        region: { tier: '"guest"', 'plays today': '19' },
        rules: ['below', 'at'],
      },
      {
        input: { tier: 'free', 'plays today': 19 },
        region: { tier: '"free"', 'plays today': '19' },
        rules: ['below', 'at'],
      },
    ]);
    expect(overlaps(decisionOf(complete))).toEqual([]);
  });

  test('ANY tolerates overlaps that agree and reports those that do not', () => {
    const any = (second: string) =>
      decisionOf({
        ...complete,
        hitPolicy: 'ANY',
        rules: [
          ...complete.rules,
          { id: 'extra', in: ['"plus"', '> 500'], out: [second] },
        ],
      });
    expect(overlaps(any('"allow"'))).toEqual([]);
    expect(overlaps(any('"deny"'))).toEqual([
      {
        input: { tier: 'plus', 'plays today': 501 },
        region: { tier: '"plus"', 'plays today': '501..1000' },
        rules: ['plus', 'extra'],
      },
    ]);
  });

  test('FIRST resolves overlaps by order', () => {
    const first = decisionOf({
      ...complete,
      hitPolicy: 'FIRST',
      rules: [
        ...complete.rules,
        { id: 'fallback', in: ['-', '-'], out: ['"deny"'] },
      ],
    });
    expect(overlaps(first)).toEqual([]);
  });
});

describe('partition', () => {
  test('a number range is cut at every threshold its rules use', () => {
    const decision = decisionOf({
      inputs: [{ name: 'n', typeRef: 'number', values: '[0..100]' }],
      outputs: [DECISION],
      rules: [
        { id: 'a', in: ['< 20'], out: ['"allow"'] },
        { id: 'b', in: ['[20..50)'], out: ['"deny"'] },
        { id: 'c', in: ['> 50, 7'], out: ['"deny"'] },
        { id: 'd', in: ['50'], out: ['"deny"'] },
      ],
    });
    expect(inputClasses(decision, 0).map((c) => c.label)).toEqual([
      '0..6',
      '7',
      '8..19',
      '20..49',
      '50',
      '51..100',
    ]);
  });

  test('a large table is analyzed exactly and quickly', () => {
    const games = Array.from({ length: 25 }, (_, i) => `"game-${String(i)}"`);
    const limits = [3, 5, 10, 20, 50, 100];
    const rules = games.flatMap((game, g) => {
      const limit = limits[g % limits.length] ?? 1;
      return [
        {
          id: `g${String(g)}-below`,
          in: [game, '"guest","free"', '-', `< ${String(limit)}`],
          out: ['"allow"'],
        },
        {
          id: `g${String(g)}-at`,
          in: [game, '"guest","free"', '-', `>= ${String(limit)}`],
          out: ['"deny"'],
        },
        {
          id: `g${String(g)}-plus`,
          in: [game, '"plus"', '-', '-'],
          out: ['"allow"'],
        },
      ];
    });
    const decision = decisionOf({
      inputs: [
        { name: 'game', typeRef: 'string', values: games.join(',') },
        TIER,
        { name: 'signed in', typeRef: 'boolean', values: 'true,false' },
        { name: 'plays today', typeRef: 'number', values: '[0..100000]' },
      ],
      outputs: [DECISION],
      rules,
    });
    expect(gaps(decision)).toEqual([]);
    expect(overlaps(decision)).toEqual([]);
    const cases = generateCases(decision);
    // plays today: 0, 1, 100000 and L-1, L, L+1 of six limits (17 distinct).
    expect(cases.length).toBe(25 * 3 * 2 * 20);
    expect(cases.every((c) => c.expected.ok)).toBe(true);
  });
});
