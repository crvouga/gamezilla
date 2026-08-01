import { fail } from '@pkgs/rules/core/fail';
import { defineRule } from '@pkgs/rules/core/define-rule';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { Failure, RulesCtx } from '@pkgs/rules/core/types';
import { CHESS_OWNER_MISMATCH, CHESS_PROFILE_ID_MISMATCH } from './codes';

const PROFILES_TABLE = 'chess_puzzle_profiles';
const INTERACTIONS_TABLE = 'chess_puzzle_interactions';
const OWNER_ID = 'owner_id';

function readOwnerId(values: Readonly<Record<string, unknown>> | undefined): unknown {
  return values?.[OWNER_ID] ?? values?.['ownerId'];
}

async function checkPuzzleProfileOwner(
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
    const ownerId = readOwnerId(row.values);
    if (ownerId !== undefined && ownerId !== ctx.auth.userId) {
      failures.push(
        fail(CHESS_OWNER_MISMATCH, { table: PROFILES_TABLE, id: row.id })
      );
      continue;
    }
    if (row.id !== ctx.auth.userId) {
      failures.push(
        fail(CHESS_PROFILE_ID_MISMATCH, {
          table: PROFILES_TABLE,
          id: row.id,
        })
      );
    }
  }

  return failures;
}

async function checkPuzzleInteractionOwner(
  ctx: RulesCtx<AppRulesAuth>
): Promise<readonly Failure[]> {
  const failures: Failure[] = [];

  for (const row of ctx.batch.rows) {
    if (row.table !== INTERACTIONS_TABLE) {
      continue;
    }
    if (row.op !== 'put' && row.op !== 'patch') {
      continue;
    }
    const ownerId = readOwnerId(row.values);
    if (ownerId !== undefined && ownerId !== ctx.auth.userId) {
      failures.push(
        fail(CHESS_OWNER_MISMATCH, {
          table: INTERACTIONS_TABLE,
          id: row.id,
        })
      );
    }
  }

  return failures;
}

export const chessPuzzleProfileOwnerBeforeRule = defineRule({
  name: 'chess/PROFILE_OWNER',
  phase: 'before',
  touches: [PROFILES_TABLE],
  check: checkPuzzleProfileOwner,
});

export const chessPuzzleProfileOwnerAfterRule = defineRule({
  name: 'chess/PROFILE_OWNER',
  phase: 'after',
  touches: [PROFILES_TABLE],
  check: checkPuzzleProfileOwner,
});

export const chessPuzzleInteractionOwnerBeforeRule = defineRule({
  name: 'chess/INTERACTION_OWNER',
  phase: 'before',
  touches: [INTERACTIONS_TABLE],
  check: checkPuzzleInteractionOwner,
});

export const chessPuzzleInteractionOwnerAfterRule = defineRule({
  name: 'chess/INTERACTION_OWNER',
  phase: 'after',
  touches: [INTERACTIONS_TABLE],
  check: checkPuzzleInteractionOwner,
});

export const CHESS_RULES = [
  chessPuzzleProfileOwnerBeforeRule,
  chessPuzzleProfileOwnerAfterRule,
  chessPuzzleInteractionOwnerBeforeRule,
  chessPuzzleInteractionOwnerAfterRule,
] as const;
