/**
 * The matched game `specs/games/matched-game-own-board.qnt` follows, of the
 * trace's game: Alice on the first side against Bob, Carol watching from
 * Alice's space, the victory's first four moves, and what each of their
 * screens shows of their own board.
 */

import {
  joinMultiplayerSpace,
  multiplayerBoardShown,
} from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import {
  givenOpponentSearch,
  pairGameOpponents,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { gameRecordOffered } from '@libs/game-matchmaking-harness-ts/multiplayer-game-record';
import {
  multiplayerView,
  shownMoveCount,
} from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  nearestMultiplayerSeat,
  shownEarlierPosition,
} from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import { chooseKnownSetups } from '@libs/game-matchmaking-harness-ts/multiplayer-setups';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared-ts/time-control';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { productClockChoice } from './matched-game-clock';
import { modelGameOf, victoryMoveAt } from './model-game';

/** Alice and Bob play; Carol watches. Each uses the device named after them. */
export const OWN_BOARD_PEOPLE = ['alice', 'bob', 'carol'] as const;
const PAIRED = ['alice', 'bob'] as const;
/**
 * The model leaves the clocks to the matched game, so it is played at a
 * clock choice no trace can run out of.
 */
const CLOCK_CHOICE = dailyTimeControlId(7);

/** The model's start: Alice has the first side against Bob, and Carol watches. */
export async function prepareOwnBoardModel(w: QuintHarnessWorld) {
  const gameId = modelGameOf(w).shared.id;
  for (const actor of PAIRED) {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(givenGameSpace, actor);
    await w.s.apply(
      givenOpponentSearch,
      actor,
      productClockChoice(w, CLOCK_CHOICE)
    );
    await w.s.advanceTime(1);
  }
  await w.s.apply(pairGameOpponents, 'alice', true);
  for (const actor of PAIRED)
    await w.s.apply(openFindingAnOpponent, actor, gameId);
  await w.s.apply(joinMultiplayerSpace, 'carol', 'alice');
}

async function currentGame(w: QuintHarnessWorld) {
  const game = (await w.s.read(multiplayerView, 'alice')).game;
  if (game === null) throw new Error('The matched game is missing');
  return game;
}

/** A command on the two people's current matched game, as the person's screen sends it. */
export async function sendOwnBoardCommand(
  w: QuintHarnessWorld,
  actor: string,
  name: string,
  args: Record<string, unknown> = {}
) {
  const game = await currentGame(w);
  const sent = Number(w.memo.get('own-board:commands') ?? 0) + 1;
  w.memo.set('own-board:commands', sent);
  await w.s.apply(sendMultiplayerCommand, actor, {
    name,
    args: { gameId: game.id, requestId: `own-board-${String(sent)}`, ...args },
  });
}

/**
 * The person makes the victory's next move on the board in front of them.
 * A watcher's board, and a board showing an earlier position, take no move:
 * the screen shows it takes none, and nothing is sent. Any other board
 * sends the move as its screen does.
 */
export async function playOwnBoardMove(w: QuintHarnessWorld, actor: string) {
  const game = await currentGame(w);
  const board = await w.s.read(multiplayerBoardShown, actor);
  const reviewing = (await w.s.read(shownEarlierPosition, actor)) !== null;
  if (!PAIRED.some((person) => person === actor) || reviewing) {
    if (board.boardTakesMoves)
      throw new Error(
        `${actor}'s board takes a move while it shows an earlier position or ${actor} only watches`
      );
    return;
  }
  await sendOwnBoardCommand(w, actor, 'playMultiplayerMove', {
    revision: game.revision,
    uci: victoryMoveAt(w, game.revision),
  });
}

/** The other person offers a rematch and this one accepts it. */
export async function acceptOwnBoardRematch(
  w: QuintHarnessWorld,
  actor: string
) {
  const offerer = actor === 'alice' ? 'bob' : 'alice';
  await sendOwnBoardCommand(w, offerer, 'offerMultiplayerRematch');
  await sendOwnBoardCommand(w, actor, 'acceptMultiplayerRematch');
  await w.s.apply(chooseKnownSetups, PAIRED);
}

/** What one person's screen shows, in the model's words. */
export type OwnBoardScreen = {
  readonly moveCount: number;
  /** `ongoing`, `white`, `black`, `draw` or `aborted`, as the screen has it. */
  readonly outcome: string | null;
  readonly playSide: 'first' | 'second' | 'none';
  /** Moves played to reach the earlier position shown; -1 for the current one. */
  readonly earlierPosition: number;
  readonly nearestSide: 'first' | 'second' | 'none';
  /** Both the game record and the final position are offered, or neither. */
  readonly gameRecordOffered: boolean | 'one of them';
};

const MODEL_SIDE = { white: 'first', black: 'second' } as const;

async function sideOf(
  w: QuintHarnessWorld,
  actor: string
): Promise<OwnBoardScreen['playSide']> {
  const game = (await w.quiet.read(multiplayerView, actor)).game;
  const owner = await w.quiet.read(accountIdOf, actor);
  if (game === null || owner === null) return 'none';
  if (game.white_id === owner) return 'first';
  return game.black_id === owner ? 'second' : 'none';
}

async function ownBoardScreen(
  w: QuintHarnessWorld,
  actor: string
): Promise<OwnBoardScreen> {
  const offered = await w.quiet.read(gameRecordOffered, actor);
  const nearest = (await w.quiet.read(nearestMultiplayerSeat, actor)).clock;
  return {
    moveCount: await w.quiet.read(shownMoveCount, actor),
    outcome: (await w.quiet.read(multiplayerBoardShown, actor)).outcome,
    playSide: await sideOf(w, actor),
    earlierPosition: (await w.quiet.read(shownEarlierPosition, actor)) ?? -1,
    nearestSide: nearest === null ? 'none' : MODEL_SIDE[nearest],
    gameRecordOffered:
      offered.gameRecord === offered.finalPosition
        ? offered.gameRecord
        : 'one of them',
  };
}

/** What each of the three people's screens shows, without acting. */
export async function readOwnBoardScreens(
  w: QuintHarnessWorld
): Promise<ReadonlyMap<string, OwnBoardScreen>> {
  const screens = new Map<string, OwnBoardScreen>();
  for (const actor of OWN_BOARD_PEOPLE)
    screens.set(actor, await ownBoardScreen(w, actor));
  return screens;
}
