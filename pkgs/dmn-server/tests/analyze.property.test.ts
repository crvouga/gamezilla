/**
 * The analysis is exact: on random tables over a small domain, checking one
 * value per class finds a gap or an overlap exactly when checking every value
 * does, and every class is a run of values no rule tells apart.
 */

import { describe, expect, test } from 'bun:test';
import { gaps, overlaps } from '@pkgs/dmn-shared/analyze';
import { matchingRules, ruleOutput } from '@pkgs/dmn-shared/evaluate';
import type { DmnDecision } from '@pkgs/dmn-shared/model';
import { inputClasses } from '@pkgs/dmn-shared/partition';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

import { decisionOf } from './fixtures/table';

const MAX = 12;
const LETTERS = ['a', 'b', 'c'] as const;

/** Thresholds may lie outside the domain; listed values may not. */
const k = fc.integer({ min: -2, max: MAX + 2 });
const inDomain = fc.integer({ min: 0, max: MAX });
const numberTest = fc.oneof(
  fc.constant('-'),
  k.map((n) => `< ${String(n)}`),
  k.map((n) => `<= ${String(n)}`),
  k.map((n) => `> ${String(n)}`),
  k.map((n) => `>= ${String(n)}`),
  inDomain.map((n) => String(n)),
  k.map((n) => `not(< ${String(n)})`),
  fc
    .tuple(k, k, fc.constantFrom('[', '(', ']'), fc.constantFrom(']', ')', '['))
    .map(
      ([a, b, open, close]) =>
        `${open}${String(Math.min(a, b))}..${String(Math.max(a, b))}${close}`
    ),
  fc.tuple(inDomain, k).map(([a, b]) => `${String(a)}, >= ${String(b)}`)
);
const letterTest = fc.constantFrom('-', '"a"', '"a","b"', 'not("c")', '"c"');
const rule = fc.record({
  letter: letterTest,
  number: numberTest,
  out: fc.constantFrom('"x"', '"y"'),
});
const table = fc.record({
  hitPolicy: fc.constantFrom('UNIQUE', 'ANY'),
  rules: fc.array(rule, { minLength: 1, maxLength: 5 }),
});

type Drawn = {
  readonly hitPolicy: string;
  readonly rules: readonly { letter: string; number: string; out: string }[];
};

function build(drawn: Drawn): DmnDecision {
  return decisionOf({
    hitPolicy: drawn.hitPolicy,
    inputs: [
      { name: 'letter', typeRef: 'string', values: '"a","b","c"' },
      { name: 'n', typeRef: 'number', values: `[0..${String(MAX)}]` },
    ],
    outputs: [{ name: 'out', typeRef: 'string', values: '"x","y"' }],
    rules: drawn.rules.map((r, i) => ({
      id: `r${String(i)}`,
      in: [r.letter, r.number],
      out: [r.out],
    })),
  });
}

/** Every point of the domain, checked one by one. */
function bruteForce(decision: DmnDecision): { gap: boolean; overlap: boolean } {
  let gap = false;
  let overlap = false;
  for (const letter of LETTERS) {
    for (let n = 0; n <= MAX; n += 1) {
      const hits = matchingRules(decision, { letter, n });
      if (hits.length === 0) gap = true;
      const answers = new Set(
        hits.map((h) => JSON.stringify(ruleOutput(decision, h)))
      );
      if (
        decision.hitPolicy === 'UNIQUE' ? hits.length > 1 : answers.size > 1
      ) {
        overlap = true;
      }
    }
  }
  return { gap, overlap };
}

describe('analysis over classes', () => {
  test('finds a gap or an overlap exactly when checking every value does', () => {
    assertProperty(
      'analysis is exact',
      fc.property(table, (drawn) => {
        const decision = build(drawn);
        const truth = bruteForce(decision);
        const found = { gaps: gaps(decision), overlaps: overlaps(decision) };
        expect(found.gaps.length > 0).toBe(truth.gap);
        expect(found.overlaps.length > 0).toBe(truth.overlap);
        for (const gap of found.gaps) {
          expect(matchingRules(decision, gap.input)).toEqual([]);
        }
        for (const overlap of found.overlaps) {
          const ids = matchingRules(decision, overlap.input).map((r) => r.id);
          expect(ids).toEqual([...overlap.rules]);
        }
      })
    );
  });

  test('every value matches the same rules as its class representative', () => {
    assertProperty(
      'classes are uniform',
      fc.property(table, (drawn) => {
        const decision = build(drawn);
        const classes = inputClasses(decision, 1);
        for (let n = 0; n <= MAX; n += 1) {
          const home = classes.filter((c) => Number(c.value) <= n).at(-1);
          expect(home).toBeDefined();
          for (const letter of LETTERS) {
            const ids = (value: number) =>
              matchingRules(decision, { letter, n: value }).map((r) => r.id);
            expect(ids(n)).toEqual(ids(Number(home?.value)));
          }
        }
      })
    );
  });
});
