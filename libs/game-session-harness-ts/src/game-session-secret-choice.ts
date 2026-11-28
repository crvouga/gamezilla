/**
 * A person's secret choice (private commitment) in a game session whose
 * sides all choose in secret before play goes on: made as a person makes
 * it, on the game's own board while it takes their choice, and read as
 * their screen shows it — their own, never another side's.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { GAME_SESSION_BOARD } from './game-session-moves';
import type { GameSessionProbe } from './game-session-probe';
import { readGameSessionProbe } from './game-session-probe';
import { chooseGameSession, waitGameSessionSettled } from './game-session-ui';
import { turnHarnessGameOf } from './harness-game-of';

/**
 * `actor` makes `commitment` their secret choice in the round that opened
 * after `ply` moves: with the game's board gesture when their board takes
 * it (a round open and theirs to choose in, connected), otherwise as a
 * modified device would send it, so any refusal is the product's.
 */
export const makeGameSessionSecretChoice = scenarioAction({
  name: 'makeGameSessionSecretChoice',
  act: async (
    s,
    actor: string,
    choice: {
      readonly gameId: string;
      readonly commitment: string;
      readonly ply: number;
    }
  ) => {
    const game = turnHarnessGameOf(s, choice.gameId);
    const probe = await readGameSessionProbe(s, actor);
    const current = probe?.current;
    if (probe === null || current === null || current === undefined)
      throw new Error(`${game.label}: ${actor} sees no game session`);
    const onBoard =
      probe.gates['move'] === true &&
      probe.mySide !== null &&
      current.awaiting.includes(probe.mySide) &&
      current.moves.length === choice.ply;
    if (onBoard) {
      await game.shared.automation.turns.perform(
        await actorUi(s, actor),
        GAME_SESSION_BOARD,
        choice.commitment
      );
      await waitGameSessionSettled(s, actor, probe.settled);
      return;
    }
    await chooseGameSession(s, actor, {
      operation: 'commit',
      commitment: choice.commitment,
      ply: choice.ply,
    });
  },
});

/** The person's own secret choice in the open round on the screen `probe` read, `null` while they have made none. */
export function secretChoiceOnScreen(probe: GameSessionProbe): string | null {
  return probe.ownCommitment;
}

/** `actor`'s own secret choice in the open round as their screen shows it. */
export async function ownGameSessionSecretChoiceShown(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const probe = await readGameSessionProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no game session`);
  return secretChoiceOnScreen(probe);
}
