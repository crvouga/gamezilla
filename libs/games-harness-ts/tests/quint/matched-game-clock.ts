/**
 * The clock choices and speeds the matched-game models name ("1+0",
 * "blitz"), as the trace's game names them among its own: every game's
 * matched games are played at the same clock choices, kept apart by the
 * game's clock namespace (`<id>/1+0`, rated at `<id>:blitz`).
 */

import type { MultiplayerSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import { gameSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { modelGameOf } from './model-game';

/** The clock namespace of `game`'s matched games. */
export function clockNamespaceOf(game: HarnessGame): string {
  const matchmaking = game.shared.turnGame.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(
      `${game.label} offers no finding an opponent, which the matched-game models need`
    );
  return matchmaking.clockNamespace;
}

/** The model's clock choice as the trace's game names it. */
export function productClockChoice(
  w: QuintHarnessWorld,
  choice: string
): string {
  return `${clockNamespaceOf(modelGameOf(w))}${choice}`;
}

/** The product's clock choice as the model names it ("none" for none). */
export function modelClockChoice(
  w: QuintHarnessWorld,
  control: string | null | undefined
): string {
  if (control === null || control === undefined) return 'none';
  const namespace = clockNamespaceOf(modelGameOf(w));
  return control.startsWith(namespace)
    ? control.slice(namespace.length)
    : `${control} (another game's)`;
}

/** The model's speed as the trace's game rates it. */
export function productSpeed(
  w: QuintHarnessWorld,
  speed: MultiplayerSpeed
): MultiplayerSpeed {
  return gameSpeed(clockNamespaceOf(modelGameOf(w)), speed);
}
