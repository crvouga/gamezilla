import { customGameLegalMoves } from '@libs/game-session-shared-ts/custom-game-position';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { readCustomGameProbe } from './custom-game-probe';
import { chooseCustomGame, waitCustomGameSettled } from './custom-game-ui';
import type { HarnessGame } from './harness-game';
import { harnessGameOf } from './harness-game-of';

/** The board every custom game is played on. */
export const CUSTOM_GAME_BOARD = 'custom-game-board';

/**
 * A legal move of the position by the game's own rules; from a finished
 * position, which has none, the game's known opening (a move legal at the
 * start of a game).
 */
export function firstLegalMove(game: HarnessGame, position: string): string {
  const move =
    game.shared.turnGame.rules.legal(position)[0] ??
    game.fixtures.firstSideVictory[0];
  if (move === undefined)
    throw new Error(`${game.label}: the game offers no first move`);
  return move;
}

/**
 * Whether the person's board takes `action` from them now: the board is on
 * screen, they are connected to the live custom game, it is under way and
 * their turn, and `action` is one of the position's legal actions or the
 * start of one (a gesture still waiting for its last choice). Anything else
 * is refused by the product, so a driver sends it as a modified device
 * would.
 */
export async function customGameBoardTakes(
  s: ProductHarness,
  actor: string,
  action: string
): Promise<boolean> {
  const probe = await readCustomGameProbe(s, actor);
  return (
    probe?.current !== null &&
    probe?.current !== undefined &&
    probe.connected &&
    probe.live &&
    probe.current.status === 'active' &&
    probe.mySide === probe.current.turn &&
    customGameLegalMoves(
      probe.current,
      s.harness.composition.app.turnGames
    ).some((legal) => legal.startsWith(action)) &&
    (await (await actorUi(s, actor)).get(CUSTOM_GAME_BOARD).isVisible())
  );
}

/**
 * A gesture on the Custom Game board, then the product's answer. The
 * gesture says whether the board took a whole action (`'made'`) or still
 * waits for a choice before anything is sent (`'waiting'`, a promotion
 * picker). Returns what the screen refused ('' when the action was
 * accepted), or `null` while the board still waits.
 */
export async function playOnCustomGameBoard(
  s: ProductHarness,
  actor: string,
  gesture: () => Promise<'made' | 'waiting'>
): Promise<string | null> {
  const before = await readCustomGameProbe(s, actor);
  if (before === null) throw new Error(`${actor} sees no Custom Game screen`);
  if ((await gesture()) === 'waiting') return null;
  return waitCustomGameSettled(s, actor, before.settled);
}

/**
 * `actor` makes `move` (default: a legal one) as a person does: on the board
 * when it takes their move, otherwise by choosing it, so a refusal is the
 * product's, never the harness's.
 */
export const makeCustomGameMove = scenarioAction({
  name: 'makeCustomGameMove',
  act: async (s, actor: string, gameId: string, move?: string) => {
    const game = harnessGameOf(s, gameId);
    const probe = await readCustomGameProbe(s, actor);
    const current = probe?.current;
    if (probe === null || current === null || current === undefined)
      throw new Error(`${game.label}: ${actor} sees no custom game`);
    const action = move ?? firstLegalMove(game, current.fen);
    if (probe.gates['move'] === true) {
      await game.shared.automation.perform(
        await actorUi(s, actor),
        CUSTOM_GAME_BOARD,
        action
      );
      await waitCustomGameSettled(s, actor, probe.settled);
      return;
    }
    await chooseCustomGame(s, actor, {
      operation: 'move',
      uci: action,
      ply: current.moves.length,
    });
  },
});
