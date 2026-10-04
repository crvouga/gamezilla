import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDecision } from '@pkgs/dmn-shared/evaluate';
import { parseDmn } from '@pkgs/dmn-shared/model';

import { decisionOf } from './fixtures/table';

const parsed = parseDmn(
  readFileSync(join(import.meta.dir, 'fixtures/access.dmn'), 'utf8')
);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const access = parsed.definitions.decisions[0];
if (access === undefined) throw new Error('no decision');

const N = { name: 'n', typeRef: 'number', values: '[0..10]' };
const OUT = { name: 'out', typeRef: 'string', values: '"low","mid","high"' };

describe('UNIQUE', () => {
  test('the one matching rule answers', () => {
    expect(
      evaluateDecision(access, {
        tier: 'guest',
        capability: 'game.play',
        'plays today': 19,
      })
    ).toEqual({
      ok: true,
      output: { decision: 'allow', reason: 'none' },
      rules: ['play-below-limit'],
    });
    expect(
      evaluateDecision(access, {
        tier: 'free',
        capability: 'game.play',
        'plays today': 20,
      })
    ).toMatchObject({
      ok: true,
      output: { decision: 'deny', reason: 'limit reached' },
    });
  });

  const overlapping = decisionOf({
    inputs: [N],
    outputs: [OUT],
    rules: [
      { id: 'a', in: ['< 5'], out: ['"low"'] },
      { id: 'b', in: ['[3..10]'], out: ['"high"'] },
    ],
  });

  test('two matching rules are an error naming both', () => {
    expect(evaluateDecision(overlapping, { n: 4 })).toEqual({
      ok: false,
      error: 'rules a, b all answer n=4 (hit policy UNIQUE allows one)',
    });
  });

  test('no matching rule is an error', () => {
    const partial = decisionOf({
      inputs: [N],
      outputs: [OUT],
      rules: [{ id: 'a', in: ['< 5'], out: ['"low"'] }],
    });
    expect(evaluateDecision(partial, { n: 7 })).toEqual({
      ok: false,
      error: 'no rule answers n=7',
    });
  });
});

describe('FIRST', () => {
  test('the first matching rule in table order answers', () => {
    const first = decisionOf({
      hitPolicy: 'FIRST',
      inputs: [N],
      outputs: [OUT],
      rules: [
        { id: 'a', in: ['< 5'], out: ['"low"'] },
        { id: 'b', in: ['-'], out: ['"high"'] },
      ],
    });
    expect(evaluateDecision(first, { n: 4 })).toMatchObject({
      output: { out: 'low' },
      rules: ['a'],
    });
    expect(evaluateDecision(first, { n: 5 })).toMatchObject({
      output: { out: 'high' },
      rules: ['b'],
    });
  });
});

describe('ANY', () => {
  const any = decisionOf({
    hitPolicy: 'ANY',
    inputs: [N],
    outputs: [OUT],
    rules: [
      { id: 'a', in: ['< 5'], out: ['"low"'] },
      { id: 'b', in: ['< 3'], out: ['"low"'] },
      { id: 'c', in: ['>= 4'], out: ['"high"'] },
    ],
  });

  test('matching rules that agree answer together', () => {
    expect(evaluateDecision(any, { n: 1 })).toEqual({
      ok: true,
      output: { out: 'low' },
      rules: ['a', 'b'],
    });
  });

  test('matching rules that disagree are an error', () => {
    expect(evaluateDecision(any, { n: 4 })).toEqual({
      ok: false,
      error: 'rules a and c answer n=4 differently (hit policy ANY)',
    });
  });
});

describe('PRIORITY', () => {
  test('the answer ranked first by the output values wins', () => {
    const priority = decisionOf({
      hitPolicy: 'PRIORITY',
      inputs: [N],
      outputs: [
        { name: 'out', typeRef: 'string', values: '"high","mid","low"' },
      ],
      rules: [
        { id: 'a', in: ['-'], out: ['"low"'] },
        { id: 'b', in: ['>= 5'], out: ['"mid"'] },
        { id: 'c', in: ['>= 8'], out: ['"high"'] },
      ],
    });
    expect(evaluateDecision(priority, { n: 1 })).toMatchObject({
      output: { out: 'low' },
    });
    expect(evaluateDecision(priority, { n: 6 })).toMatchObject({
      output: { out: 'mid' },
      rules: ['b'],
    });
    expect(evaluateDecision(priority, { n: 9 })).toMatchObject({
      output: { out: 'high' },
      rules: ['c'],
    });
  });
});

describe('inputs the spec does not cover', () => {
  const ok = { tier: 'guest', capability: 'game.play', 'plays today': 0 };
  const errors: readonly [
    string,
    Record<string, string | number | boolean | null>,
    string,
  ][] = [
    [
      'a missing input',
      { tier: 'guest', capability: 'game.play' },
      'input "plays today" is missing',
    ],
    [
      'an unknown input',
      { ...ok, age: 3 },
      'decision access has no input "age"',
    ],
    [
      'a value outside the listed values',
      { ...ok, tier: 'gold' },
      'tier="gold" is outside the declared values ("guest", "free", "plus")',
    ],
    [
      'a number outside the range',
      { ...ok, 'plays today': 1001 },
      'plays today=1001 is outside the declared values ([0..1000])',
    ],
    [
      'a fraction in a whole-number range',
      { ...ok, 'plays today': 1.5 },
      'plays today=1.5 is outside',
    ],
    [
      'a value of the wrong type',
      { ...ok, 'plays today': '3' },
      'plays today="3" is outside',
    ],
    [
      'null where the domain has none',
      { ...ok, tier: null },
      'tier=null is outside',
    ],
  ];
  for (const [what, input, message] of errors) {
    test(what, () => {
      const result = evaluateDecision(access, input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain(message);
    });
  }
});
