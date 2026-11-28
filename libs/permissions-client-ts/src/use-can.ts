import {
  decideMatchedGameAllowance,
  type MatchedGamesLeft,
  matchedGamesLeftShown,
} from '@libs/permissions-shared-ts/matched-game-allowance';
import type {
  AppGrantKey,
  AppLimit,
} from '@libs/permissions-shared-ts/permission-catalog';
import {
  LIMIT,
  PERMISSION,
} from '@libs/permissions-shared-ts/permission-catalog';
import type { UnfinishedGames } from '@libs/permissions-shared-ts/unfinished-games-permission';
import { decideUnfinishedGames } from '@libs/permissions-shared-ts/unfinished-games-permission';
import { useClock } from '@pkgs/clock-client-ts/solid';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { decide, decideLimit } from '@pkgs/permissions-shared-ts/decision';
import { type Accessor, createMemo } from 'solid-js';
import type { AccessScopeAccessor } from './use-permission-subject';
import { usePermissionInputs } from './use-permission-subject';
import { usePrivacyDecision } from './use-privacy-decision';

/** A live decision for holding one more of a consumer's counted resource. */
export function useLimitDecision(
  key: AppLimit,
  used: Accessor<number>
): Accessor<Decision> {
  const { policy, subject } = usePermissionInputs();
  return () => decideLimit(policy(), subject(), key, used());
}

/**
 * A live decision for seeking another multiplayer game: the unfinished
 * multiplayer game limit, then an active Game Session the caller takes part in.
 */
export function useUnfinishedGamesDecision(
  held: Accessor<UnfinishedGames>
): Accessor<Decision> {
  const limit = useLimitDecision(
    LIMIT.unfinishedMultiplayerGames,
    () => held().multiplayer
  );
  return () => decideUnfinishedGames(limit(), held().gameSessions);
}

/**
 * Today's matched game allowance as this device knows it, from when each of
 * the caller's matched games that got under way began: whether one more may
 * begin, and how many are left once few are (`matchedGamesLeftShown`).
 */
export function useMatchedGameAllowance(
  begunAt: Accessor<readonly unknown[]>
): {
  readonly decision: Accessor<Decision>;
  readonly left: Accessor<MatchedGamesLeft | null>;
} {
  const { policy, subject } = usePermissionInputs();
  const clock = useClock();
  const at = () => ({ startedAt: begunAt(), nowMs: clock.now() });
  return {
    decision: () => decideMatchedGameAllowance(policy(), subject(), at()),
    left: () => matchedGamesLeftShown(policy(), subject(), at()),
  };
}

/**
 * The caller's live decision for `key` (restrictions applied). `scope` adds
 * resource roles, e.g. `() => ({ spacePresence: 'host' })` inside a space.
 */
export function useDecision(
  key: AppGrantKey,
  scope?: AccessScopeAccessor
): Accessor<Decision> {
  return useDecisionRead(key, scope).decision;
}

/** Readiness follows the very same inputs used for the decision. */
export function useDecisionRead(key: AppGrantKey, scope?: AccessScopeAccessor) {
  const { policy, subject, isLoading } = usePermissionInputs(scope);
  const privacyDecision =
    key === PERMISSION.profileDeleteAccount ||
    key === PERMISSION.profileExportData
      ? usePrivacyDecision()
      : null;
  const read = () => {
    const decision = decide(policy(), subject(), key);
    return privacyDecision === null ? decision : privacyDecision(key, decision);
  };
  return { decision: read, isLoading };
}

/** Whether the caller may `key` right now. */
export function useCan(
  key: AppGrantKey,
  scope?: AccessScopeAccessor
): Accessor<boolean> {
  const decision = useDecision(key, scope);
  return createMemo(() => decision().allowed);
}
