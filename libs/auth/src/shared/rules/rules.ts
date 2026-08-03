import { fail } from '@pkgs/rules/core/fail';
import { defineRule } from '@pkgs/rules/core/define-rule';
import type { Failure, RulesCtx } from '@pkgs/rules/core/types';
import type { AppRulesAuth } from '../app-rules-auth';
import { AUTH_DEVICE_ID_MISMATCH, AUTH_DEVICE_REQUIRED } from './codes';

const DEVICES_TABLE = 'devices';

async function checkDeviceOwnId(
  ctx: RulesCtx<AppRulesAuth>
): Promise<readonly Failure[]> {
  const failures: Failure[] = [];

  for (const row of ctx.batch.rows) {
    if (row.table !== DEVICES_TABLE) {
      continue;
    }
    if (row.op !== 'put' && row.op !== 'patch') {
      continue;
    }
    if (ctx.auth.deviceId.length === 0) {
      failures.push(
        fail(AUTH_DEVICE_REQUIRED, { table: DEVICES_TABLE, id: row.id })
      );
      continue;
    }
    if (row.id !== ctx.auth.deviceId) {
      failures.push(
        fail(AUTH_DEVICE_ID_MISMATCH, { table: DEVICES_TABLE, id: row.id })
      );
    }
  }

  return failures;
}

export const deviceOwnIdBeforeRule = defineRule({
  name: 'auth/DEVICE_OWN_ID',
  phase: 'before',
  touches: [DEVICES_TABLE],
  check: checkDeviceOwnId,
});

export const deviceOwnIdAfterRule = defineRule({
  name: 'auth/DEVICE_OWN_ID',
  phase: 'after',
  touches: [DEVICES_TABLE],
  check: checkDeviceOwnId,
});

export const AUTH_RULES = [
  deviceOwnIdBeforeRule,
  deviceOwnIdAfterRule,
] as const;
