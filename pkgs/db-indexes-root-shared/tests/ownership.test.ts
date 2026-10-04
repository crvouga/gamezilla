import { describe, expect, test } from 'bun:test';
import {
  isOwnedName,
  ownedIndexName,
} from '@pkgs/db-indexes-root-shared/naming';
import { planIndexes } from '@pkgs/db-indexes-root-shared/plan';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { genDbState } from './db-state';
import { genSmallManifest } from './manifest';
import { fixedClock, RecordingPort } from './recording-port';
import { genSchema } from './schema';

describe('ownership PBT', () => {
  test('no action references non-owned or unique imposters', async () => {
    const now = 1_700_000_000_000;
    await assertProperty(
      'ownership',
      fc.asyncProperty(
        genSchema.chain((schema) =>
          fc.record({
            state: genDbState(schema, now),
            manifest: genSmallManifest(schema),
          })
        ),
        async ({ state, manifest }) => {
          const db = new RecordingPort({
            indexes: state.indexes,
            tables: state.tables,
            usage: state.usage,
            metas: state.metas,
            defaultImprovement: 10,
          });
          const plan = await planIndexes({
            manifest,
            db,
            clock: fixedClock(now),
            config: { minTableRows: 1, maxIndexesPerTable: 6 },
          });
          for (const a of plan.actions) {
            expect(isOwnedName(a.name)).toBe(true);
            expect(a.name.startsWith('ix_')).toBe(false);
            expect(a.name.startsWith('ux_')).toBe(false);
            const ix = state.indexes.find((x) => x.name === a.name);
            if (ix?.isUnique) {
              throw new Error(`action on unique imposter ${a.name}`);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('INCLUDE order does not change owned name', () => {
    assertProperty(
      'include order',
      fc.property(
        fc.array(fc.stringMatching(/^[a-z][a-z0-9_]{0,8}$/), {
          minLength: 2,
          maxLength: 4,
        }),
        (cols) => {
          const uniq = [...new Set(cols)];
          if (uniq.length < 2) return;
          const a = ownedIndexName({
            table: 'notes',
            columns: [{ name: 'user_id', order: 'asc' }],
            include: uniq,
            predicate: null,
          });
          const b = ownedIndexName({
            table: 'notes',
            columns: [{ name: 'user_id', order: 'asc' }],
            include: [...uniq].reverse(),
            predicate: null,
          });
          expect(a).toBe(b);
        }
      ),
      { numRuns: 30 }
    );
  });
});
