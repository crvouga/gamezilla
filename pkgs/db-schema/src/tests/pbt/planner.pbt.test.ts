import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/pbt';
import { emptyCatalog } from '../../test/fixtures';
import { planClient, planServer } from '../../core/plan';
import { SERVER_OPERATION_KINDS } from '../../core/operations';
import { arbSchema, fc } from '../generators';

const FRESH_KINDS = new Set([
  'create_table',
  'create_index',
  'add_check',
  'create_view',
  'create_enum',
]);

describe('db-schema planner PBT', () => {
  test('fresh schema plans only additive operations on server', () => {
    assertProperty(
      'empty catalog → create only',
      fc.property(arbSchema(), (schema) => {
        const plan = planServer(schema._declared, emptyCatalog());
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        for (const op of plan.operations) {
          expect(SERVER_OPERATION_KINDS).toContain(op.kind);
          if (
            op.kind !== 'create_index' &&
            op.kind !== 'create_table' &&
            op.kind !== 'add_check' &&
            op.kind !== 'create_view' &&
            op.kind !== 'create_enum'
          ) {
            expect(FRESH_KINDS.has(op.kind) || op.kind === 'backfill').toBe(
              true
            );
          }
        }
      }),
      { numRuns: 30 }
    );
  });

  test('fresh schema plans only additive operations on client', () => {
    assertProperty(
      'empty catalog → create only (client)',
      fc.property(arbSchema(), (schema) => {
        const plan = planClient(schema._declared, emptyCatalog());
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        for (const op of plan.operations) {
          expect(
            op.kind === 'create_table' ||
              op.kind === 'create_index' ||
              op.kind === 'add_check' ||
              op.kind === 'create_view'
          ).toBe(true);
        }
      }),
      { numRuns: 30 }
    );
  });
});
