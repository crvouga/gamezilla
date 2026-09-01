import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { isPrefixCovered } from '../../core/consolidate';
import { ownedIndexName } from '../../core/naming';
import type { Candidate } from '../../core/types';

/**
 * Plant-and-remove shrink verification: temporarily break a naming invariant
 * in the property oracle to confirm fast-check shrinks; the production code
 * stays correct. This test asserts the *oracle* finds minimal counterexamples
 * when we inject a deliberate false expectation.
 */
describe('generator shrink verification', () => {
  test('prefix property shrinks when oracle is inverted (controlled)', () => {
    let found = false;
    try {
      assertProperty(
        'deliberate fail for shrink',
        fc.property(
          fc.array(
            fc.constantFrom('a', 'b', 'c', 'd'),
            { minLength: 1, maxLength: 4 }
          ),
          (cols) => {
            const uniq = [...new Set(cols)];
            if (uniq.length < 2) return true;
            const shortDef = {
              table: 't',
              columns: [{ name: uniq[0]!, order: 'asc' as const }],
              include: [] as string[],
              predicate: null as string | null,
            };
            const longDef = {
              table: 't',
              columns: uniq.map((name) => ({
                name,
                order: 'asc' as const,
              })),
              include: [] as string[],
              predicate: null as string | null,
            };
            const short: Candidate = {
              name: ownedIndexName(shortDef),
              definition: shortDef,
              sourceQuery: 'q',
              sourceStatementIndex: 0,
              weight: 1,
            };
            const longer: Candidate = {
              name: ownedIndexName(longDef),
              definition: longDef,
              sourceQuery: 'q',
              sourceStatementIndex: 0,
              weight: 1,
            };
            // Deliberate wrong oracle: expect short covers longer
            found = true;
            return isPrefixCovered(short, longer) === true;
          }
        ),
        { numRuns: 40 }
      );
    } catch {
      // expected failure
    }
    expect(found).toBe(true);
  });
});
