import { describe, expect, test } from 'bun:test';
import { caseValues, generateCases } from '@pkgs/dmn/cases';

import { decisionOf } from './fixtures/table';

const TIER = {
  name: 'tier',
  typeRef: 'string',
  values: '"guest","free","plus"',
};
const DECISION = {
  name: 'decision',
  typeRef: 'string',
  values: '"allow","deny"',
};

describe('generated cases', () => {
  const decision = decisionOf({
    inputs: [
      TIER,
      { name: 'plays today', typeRef: 'number', values: '[0..1000]' },
    ],
    outputs: [DECISION],
    rules: [
      { id: 'below', in: ['"guest","free"', '< 20'], out: ['"allow"'] },
      { id: 'at', in: ['"guest","free"', '>= 20'], out: ['"deny"'] },
      { id: 'plus', in: ['"plus"', '-'], out: ['"allow"'] },
    ],
  });

  test('a limit L is checked at L-1, L and L+1, beside 0, 1 and the domain ends', () => {
    expect(caseValues(decision, 1)).toEqual([0, 1, 19, 20, 21, 1000]);
    expect(caseValues(decision, 0)).toEqual(['guest', 'free', 'plus']);
  });

  test('every listed value crosses every representative, with the reference answer and a stable id', () => {
    const cases = generateCases(decision);
    expect(cases).toHaveLength(3 * 6);
    expect(cases.map((c) => c.id).slice(0, 6)).toEqual([
      'tier=guest/plays today=0',
      'tier=guest/plays today=1',
      'tier=guest/plays today=19',
      'tier=guest/plays today=20',
      'tier=guest/plays today=21',
      'tier=guest/plays today=1000',
    ]);
    const at = cases.find((c) => c.id === 'tier=free/plays today=20');
    expect(at?.input).toEqual({ tier: 'free', 'plays today': 20 });
    expect(at?.expected).toEqual({
      ok: true,
      output: { decision: 'deny' },
      rules: ['at'],
    });
  });

  test('boundaries are clipped to the domain, and 0 and 1 only when inside it', () => {
    const narrow = decisionOf({
      inputs: [{ name: 'n', typeRef: 'number', values: '[5..30]' }],
      outputs: [DECISION],
      rules: [
        { id: 'a', in: ['<= 5'], out: ['"allow"'] },
        { id: 'b', in: ['(5..30]'], out: ['"deny"'] },
        { id: 'c', in: ['> 40'], out: ['"deny"'] },
      ],
    });
    expect(caseValues(narrow, 0)).toEqual([5, 6, 29, 30]);
  });

  test('a fractional threshold is checked at the whole numbers around it', () => {
    const fractional = decisionOf({
      inputs: [{ name: 'n', typeRef: 'number', values: '[0..10]' }],
      outputs: [DECISION],
      rules: [
        { id: 'a', in: ['< 2.5'], out: ['"allow"'] },
        { id: 'b', in: ['>= 2.5'], out: ['"deny"'] },
      ],
    });
    expect(caseValues(fractional, 0)).toEqual([0, 1, 2, 3, 10]);
  });

  test('a table with a gap yields a case whose reference answer is an error', () => {
    const partial = decisionOf({
      inputs: [TIER],
      outputs: [DECISION],
      rules: [{ id: 'a', in: ['"guest"'], out: ['"deny"'] }],
    });
    expect(generateCases(partial).map((c) => c.expected.ok)).toEqual([
      true,
      false,
      false,
    ]);
  });
});
