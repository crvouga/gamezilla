/**
 * Managed insert columns are a pure function of the injected clock and id
 * source: one timestamp for created/updated, an explicit id always wins.
 */
import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import {
  managedInsertColumns,
  managedUpdatedAtIso,
} from '@pkgs/sync-engine/shared';

// Year 1970..2200 in ms — the range Date#toISOString renders as YYYY-….
const arbNowMs = fc.integer({ min: 0, max: 7_258_118_400_000 });

describe('managedInsertColumns', () => {
  test('created_at = updated_at = ISO(now); explicit id overrides the minted one', () => {
    assertProperty(
      'managedInsertColumns',
      fc.property(
        arbNowMs,
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.option(fc.string({ maxLength: 12 }), { nil: undefined }),
        (nowMs, minted, explicit) => {
          let mintCalls = 0;
          const createId = () => {
            mintCalls += 1;
            return minted;
          };
          const cols = managedInsertColumns(createId, () => nowMs, explicit);
          expect(cols.created_at).toBe(cols.updated_at);
          expect(Date.parse(cols.created_at)).toBe(nowMs);
          expect(cols.created_at).toBe(managedUpdatedAtIso(() => nowMs));
          expect(cols.id).toBe(explicit ?? minted);
          expect(mintCalls).toBe(explicit === undefined ? 1 : 0);
        }
      )
    );
  });
});
