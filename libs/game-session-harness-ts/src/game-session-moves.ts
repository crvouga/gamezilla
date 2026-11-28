import { gameSessionLegalMoves } from '@libs/game-session-shared-ts/game-session-position';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { readGameSessionProbe } from './game-session-probe';
import { chooseGameSession, waitGameSessionSettled } from './game-session-ui';
import type { TurnHarnessGame } from './harness-game';
import { turnHarnessGameOf } from './harness-game-of';

/** The board every game session is played on. */
export const GAME_SESSION_BOARD = 'game-session-board';

/**
 * A legal move of the position by the game's own rules; from a finished
 * position, which has none, the game's known opening (a move legal at the
 * start of a game).
 */
export function firstLegalMove(
  game: TurnHarnessGame,
  position: string
): string {
  const move =
    game.shared.turnGame.rules.legal(position)[0] ??
    game.fixtures.firstSideVictory[0];
  if (move === undefined)
    throw new Error(`${game.label}: the game offers no first move`);
  return move;
}

/**
 * Whether the person's board takes `action` from them now: the board is on
 * screen, they are connected to the live game session, it is under way and
 * their turn, and `action` is one of the position's legal actions or the
 * start of one (a gesture still waiting for its last choice). Anything else
 * is refused by the product, so a driver sends it as a modified device
 * would.
 */
export async function gameSessionBoardTakes(
  s: ProductHarness,
  actor: string,
  action: string
): Promise<boolean> {
  const probe = await readGameSessionProbe(s, actor);
  return (
    probe?.current !== null &&
    probe?.current !== undefined &&
    probe.connected &&
    probe.live &&
    probe.current.status === 'active' &&
    probe.mySide === probe.current.turn &&
    gameSessionLegalMoves(
      probe.current,
      s.harness.composition.app.turnGames
    ).some((legal) => legal.startsWith(action)) &&
    (await (await actorUi(s, actor)).get(GAME_SESSION_BOARD).isVisible())
  );
}

/**
 * A gesture on the Game Session board, then the product's answer. The
 * gesture says whether the board took a whole action (`'made'`) or still
 * waits for a choice before anything is sent (`'waiting'`, a promotion
 * picker). Returns what the screen refused ('' when the action was
 * accepted), or `null` while the board still waits.
 */
export async function playOnGameSessionBoard(
  s: ProductHarness,
  actor: string,
  gesture: () => Promise<'made' | 'waiting'>
): Promise<string | null> {
  const before = await readGameSessionProbe(s, actor);
  if (before === null) throw new Error(`${actor} sees no Game Session screen`);
  if ((await gesture()) === 'waiting') return null;
  return waitGameSessionSettled(s, actor, before.settled);
}

/**
 * `actor` makes `move` (default: a legal one) as a person does: on the board
 * when it takes their move, otherwise by choosing it, so a refusal is the
 * product's, never the harness's.
 */
export const makeGameSessionMove = scenarioAction({
  name: 'makeGameSessionMove',
  act: async (s, actor: string, gameId: string, move?: string) => {
    const game = turnHarnessGameOf(s, gameId);
    const probe = await readGameSessionProbe(s, actor);
    const current = probe?.current;
    if (probe === null || current === null || current === undefined)
      throw new Error(`${game.label}: ${actor} sees no game session`);
    const action = move ?? firstLegalMove(game, current.fen);
    if (probe.gates['move'] === true) {
      await game.shared.automation.turns.perform(
        await actorUi(s, actor),
        GAME_SESSION_BOARD,
        action
      );
      await waitGameSessionSettled(s, actor, probe.settled);
      return;
    }
    await chooseGameSession(s, actor, {
      operation: 'move',
      uci: action,
      ply: current.moves.length,
    });
  },
});
