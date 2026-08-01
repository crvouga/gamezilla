import { describe, expect, test } from 'bun:test';

import { createInMemorySqlClient } from '@pkgs/sql-client/impl-in-memory';
import { createUploadBatch } from '@pkgs/sync-engine/shared/upload-batch';

import { defineRule } from './define-rule';
import { fail } from './fail';
import { isRulesReject } from './rules-reject';
import { runRules } from './run-rules';
import type { RulesAuth, RulesCtx } from './types';

const auth: RulesAuth = {
  subjectId: 'user-1',
  deviceId: 'device-1',
  accountId: 'user-1',
  myId: 'user-1',
  isAnonymous: false,
  memberOfSpaceIds: [],
};

function makeCtx(
  phase: RulesCtx['phase'],
  rows: Parameters<typeof createUploadBatch>[0]
): RulesCtx {
  return {
    phase,
    auth,
    batch: createUploadBatch(rows),
    db: createInMemorySqlClient(),
  };
}

describe('runRules', () => {
  test('runs rules matching phase and touches', async () => {
    let ran = false;
    const rule = defineRule({
      name: 'test/widget',
      phase: 'before',
      touches: ['widgets'],
      check: async () => {
        ran = true;
        return [];
      },
    });

    await runRules(
      makeCtx('before', [{ op: 'patch', table: 'widgets', id: '1' }]),
      [rule]
    );

    expect(ran).toBe(true);
  });

  test('skips rules on the wrong phase', async () => {
    let ran = false;
    const rule = defineRule({
      name: 'test/phase',
      phase: 'after',
      touches: [],
      check: async () => {
        ran = true;
        return [];
      },
    });

    await runRules(makeCtx('before', []), [rule]);

    expect(ran).toBe(false);
  });

  test('skips rules when batch does not touch listed tables', async () => {
    let ran = false;
    const rule = defineRule({
      name: 'test/touches',
      phase: 'before',
      touches: ['widgets'],
      check: async () => {
        ran = true;
        return [];
      },
    });

    await runRules(
      makeCtx('before', [{ op: 'patch', table: 'profiles', id: '1' }]),
      [rule]
    );

    expect(ran).toBe(false);
  });

  test('throws RulesReject when a rule returns failures', async () => {
    const rule = defineRule({
      name: 'test/deny',
      phase: 'before',
      touches: [],
      check: async () => [fail('DENIED')],
    });

    try {
      await runRules(makeCtx('before', []), [rule]);
      expect.unreachable();
    } catch (error) {
      expect(isRulesReject(error)).toBe(true);
      if (isRulesReject(error)) {
        expect(error.failures).toEqual([{ code: 'DENIED' }]);
      }
    }
  });
});
