import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerDeadlineMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';

/** A live room has finished while this device's copy of the same game is still in play. */
export function unrecordedLiveResult(
  shown: MultiplayerGame | null,
  stored: MultiplayerGame | null
): string | null {
  return shown !== null &&
    shown.outcome !== 'ongoing' &&
    stored?.id === shown.id &&
    stored.outcome === 'ongoing' &&
    stored.turn === ''
    ? shown.id
    : null;
}

/**
 * The game this device asks the server to settle now, if any: one whose
 * deadline passed (a missed first move or a clock at zero), or a live game
 * whose room shows a result its durable record does not have yet, which
 * the durable record then takes now rather than at the next scheduled sweep.
 */
export function multiplayerSettleDue(
  shown: MultiplayerGame | null,
  stored: MultiplayerGame | null,
  nowMs: number
): string | null {
  if (shown === null) return null;
  const unrecorded = unrecordedLiveResult(shown, stored);
  if (unrecorded !== null) return unrecorded;
  const deadline = multiplayerDeadlineMs(shown);
  return deadline !== null && nowMs >= deadline ? shown.id : null;
}
