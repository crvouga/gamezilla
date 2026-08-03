import { fail } from '@pkgs/rules/core/fail';
import { defineRule } from '@pkgs/rules/core/define-rule';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { Failure, RulesCtx } from '@pkgs/rules/core/types';
import { PROFILE_ID_MISMATCH } from './codes';

const PROFILES_TABLE = 'profiles';

async function checkProfileOwnId(
  ctx: RulesCtx<AppRulesAuth>
): Promise<readonly Failure[]> {
  const failures: Failure[] = [];

  for (const row of ctx.batch.rows) {
    if (row.table !== PROFILES_TABLE) {
      continue;
    }
    if (row.op !== 'put' && row.op !== 'patch') {
      continue;
    }
    if (row.id !== ctx.auth.userId) {
      failures.push(
        fail(PROFILE_ID_MISMATCH, { table: PROFILES_TABLE, id: row.id })
      );
    }
  }

  return failures;
}

export const profileOwnIdBeforeRule = defineRule({
  name: 'profile/OWN_ID',
  phase: 'before',
  touches: [PROFILES_TABLE],
  check: checkProfileOwnId,
});

export const profileOwnIdAfterRule = defineRule({
  name: 'profile/OWN_ID',
  phase: 'after',
  touches: [PROFILES_TABLE],
  check: checkProfileOwnId,
});

export const PROFILE_RULES = [
  profileOwnIdBeforeRule,
  profileOwnIdAfterRule,
] as const;
