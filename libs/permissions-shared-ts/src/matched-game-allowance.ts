import { isGuestUser } from '@libs/auth-shared-ts/anon-user-service';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import {
  decideLimit,
  decideQuota,
  quotaWindowOf,
} from '@pkgs/permissions-shared-ts/decision';
import type { PolicyVersion } from '@pkgs/permissions-shared-ts/policy';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import type { Subject } from '@pkgs/permissions-shared-ts/subject';
import type {
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { unitsSince } from './ledger-time';
import type { AppLimit, AppPolicyKey } from './permission-catalog';
import { ACTION, LIMIT } from './permission-catalog';
import { MATCHED_GAMES_LEFT_SHOWN_AT } from './permission-policy';
import type { AccessIdentity, AccessReader } from './read-access';
import { readAccess } from './read-access';

/**
 * `specs/games/daily-matched-game-limit.dmn`: may the person start one more
 * matched game today? The use is the matched games they started (any game),
 * each counted at the instant it started, inside the quota's window; there is
 * no ledger to charge, so a search that never became a game uses nothing.
 * Callers pass only matched games that got under way: one aborted before it
 * was under way is not counted.
 */
export function decideMatchedGameAllowance(
  policy: PolicyVersion<AppPolicyKey, AppLimit>,
  subject: Subject,
  args: {
    /** When each of the person's matched games began (any stored form). */
    readonly startedAt: readonly unknown[];
    readonly nowMs: number;
    /** Matched games asked for; `0` asks what is left right now. */
    readonly amount?: number;
  }
): Decision {
  const quota = ACTION.matchedGameStart;
  const window = quotaWindowOf(policy, subject, quota, { nowMs: args.nowMs });
  const used =
    window === undefined
      ? 0
      : unitsSince(
          args.startedAt.map((at) => ({ amount: 1, consumed_at: at })),
          window.startMs
        );
  return decideQuota(policy, subject, quota, {
    used,
    nowMs: args.nowMs,
    amount: args.amount ?? 1,
  });
}

/** How many matched games are left today, shown with its way to unlimited. */
export type MatchedGamesLeft = {
  readonly left: number;
  /** The refusal past what is left: its unlock is the way to unlimited. */
  readonly unlock: Decision;
};

/**
 * What a guest is told about today's allowance before reaching it: how many
 * matched games are left, once `MATCHED_GAMES_LEFT_SHOWN_AT` or fewer are and
 * at least one is. `null` otherwise — plenty left, none left (the refusal
 * says so), or no limit at all.
 */
export function matchedGamesLeftShown(
  policy: PolicyVersion<AppPolicyKey, AppLimit>,
  subject: Subject,
  args: { readonly startedAt: readonly unknown[]; readonly nowMs: number }
): MatchedGamesLeft | null {
  const now = decideMatchedGameAllowance(policy, subject, {
    ...args,
    amount: 0,
  });
  const left = now.remaining;
  if (left === undefined || left === 0 || left > MATCHED_GAMES_LEFT_SHOWN_AT)
    return null;
  return {
    left,
    unlock: decideMatchedGameAllowance(policy, subject, {
      ...args,
      amount: left + 1,
    }),
  };
}

/** Today's matched game allowance of `identity`, from their synced access. */
async function allowanceOf(
  tx: AccessReader,
  identity: AccessIdentity,
  at: {
    readonly startedAt: readonly unknown[];
    readonly nowMs: number;
    readonly clientAtMs: number;
  }
): Promise<Decision> {
  const access = await readAccess(tx, identity, at.nowMs);
  const policy = policyAt(access.policy, at.clientAtMs);
  return decideMatchedGameAllowance(
    policy,
    resolveSubject(policy, access.facts, []),
    { startedAt: at.startedAt, nowMs: at.nowMs }
  );
}

/**
 * Throws a permanent `MutationError` (code = the denial reason, meta = the
 * decision, whose way forward is signing in) when the actor, who began
 * matched games at `startedAt`, has used today's matched game allowance.
 */
export async function requireMatchedGameAllowanceInMutation(
  ctx: { readonly tx: MutationDb; readonly env: MutationEnv },
  startedAt: readonly unknown[]
): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const decision = await allowanceOf(ctx.tx, ctx.env, {
    startedAt,
    nowMs,
    clientAtMs: Math.min(ctx.env.now().getTime(), nowMs),
  });
  if (decision.allowed) return;
  throw new MutationError(
    decision.reason ?? 'quota_exhausted',
    `Quota ${ACTION.matchedGameStart} denied.`,
    { decision }
  );
}

/**
 * Whether another person, who began matched games at `startedAt`, may begin
 * one more today: a guest within today's matched game allowance, or an
 * account. Someone unknown here (never signed in on this server) is decided
 * as an account.
 */
export async function otherPersonHasMatchedGameLeft(
  tx: MutationDb,
  person: {
    readonly id: string;
    readonly startedAt: readonly unknown[];
    readonly nowMs: number;
  }
): Promise<boolean> {
  const guest = (await isGuestUser(tx, person.id)) === true;
  const identity: AccessIdentity = {
    actorId: person.id,
    accountId: guest ? null : person.id,
    isAnon: guest,
  };
  return (
    await allowanceOf(tx, identity, {
      startedAt: person.startedAt,
      nowMs: person.nowMs,
      clientAtMs: person.nowMs,
    })
  ).allowed;
}

/**
 * Whether the actor may seek an opponent for one more matched game, from one
 * read of their access: the unfinished matched game limit first (they hold
 * `unfinished`), then today's matched game allowance (they started games at
 * `startedAt`). Throws a permanent `MutationError` (code = the denial reason,
 * meta = the decision, which offers its way forward) on a refusal.
 */
export async function requireMatchedGameLimitsInMutation(
  ctx: { readonly tx: MutationDb; readonly env: MutationEnv },
  held: {
    readonly unfinished: number;
    readonly startedAt: readonly unknown[];
  }
): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const access = await readAccess(ctx.tx, ctx.env, nowMs);
  const policy = policyAt(
    access.policy,
    Math.min(ctx.env.now().getTime(), nowMs)
  );
  const subject = resolveSubject(policy, access.facts, []);
  const limit = decideLimit(
    policy,
    subject,
    LIMIT.unfinishedMultiplayerGames,
    held.unfinished
  );
  const decision = limit.allowed
    ? decideMatchedGameAllowance(policy, subject, {
        startedAt: held.startedAt,
        nowMs,
      })
    : limit;
  if (decision.allowed) return;
  throw new MutationError(
    decision.reason ?? 'not_granted',
    limit.allowed
      ? `Quota ${ACTION.matchedGameStart} denied.`
      : `Limit reached: ${LIMIT.unfinishedMultiplayerGames}`,
    { decision }
  );
}
