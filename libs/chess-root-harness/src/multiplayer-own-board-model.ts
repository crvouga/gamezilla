import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { sendMultiplayerCommand } from '@libs/chess-matchmaking-harness/multiplayer-commands';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { gameRecordOffered } from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import {
  playMultiplayerMove,
  shownEarlierPosition,
  shownMultiplayerBoard,
  shownMultiplayerMoveCount,
  tryMultiplayerPiece,
} from '@libs/chess-matchmaking-harness/multiplayer-own-board';
import { shownMultiplayerLineup } from '@libs/chess-matchmaking-harness/multiplayer-presentation';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import {
  joinMultiplayerSpace,
  multiplayerWatcherBoard,
} from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';

/** Alice and Bob play; Carol watches. Each uses the device named after them. */
export const OWN_BOARD_PEOPLE = ['alice', 'bob', 'carol'] as const;
const MATCHED = ['alice', 'bob'] as const;
/** The four accepted moves the model bounds a game to. */
const LINE = ['e2e4', 'e7e5', 'g1f3', 'b8c6'] as const;
/**
 * The model leaves the multiplayer clocks to multiplayer chess, so the game
 * is played at a time control no trace can run out of.
 */
const TIME_CONTROL = dailyTimeControlId(7);

/** The model's start: Alice is White against Bob, and Carol watches. */
export const prepareOwnBoardModel = scenarioAction({
  name: 'prepareOwnBoardModel',
  act: async (s) => {
    for (const actor of MATCHED) {
      await Promise.resolve(signInWithGoogle.act(s, actor));
      await Promise.resolve(givenMultiplayerSpace.act(s, actor));
      await Promise.resolve(givenOpponentSearch.act(s, actor, TIME_CONTROL));
      await s.session.advanceTime(1);
    }
    await Promise.resolve(pairChessOpponents.act(s, 'alice', true));
    for (const actor of MATCHED)
      await Promise.resolve(openMultiplayerChess.act(s, actor));
    await Promise.resolve(joinMultiplayerSpace.act(s, 'carol', 'alice'));
  },
});

async function currentGame(s: ProductHarness) {
  const game = (await multiplayerView(s, 'alice')).game;
  if (game === null) throw new Error('The multiplayer game is missing');
  return game;
}

/**
 * The person plays the next move of the line on the board they have in
 * front of them. A watcher has no move to send: their hand can only try the
 * piece on the board.
 */
export const playOwnBoardMove = scenarioAction({
  name: 'playOwnBoardMove',
  act: async (s, actor: string) => {
    const game = await currentGame(s);
    const uci = LINE[game.revision] ?? LINE[0];
    if (!MATCHED.some((person) => person === actor)) {
      await Promise.resolve(tryMultiplayerPiece.act(s, actor, uci));
      return;
    }
    await Promise.resolve(
      playMultiplayerMove.act(s, actor, {
        name: 'playMultiplayerMove',
        args: {
          gameId: game.id,
          requestId: s.session.ports.createId(),
          revision: game.revision,
          uci,
        },
      })
    );
  },
});

/** A command on the two people's current game, as the person's screen sends it. */
export const sendOwnBoardCommand = scenarioAction({
  name: 'sendOwnBoardCommand',
  act: async (s, actor: string, name: string) => {
    const game = await currentGame(s);
    await Promise.resolve(
      sendMultiplayerCommand.act(s, actor, {
        name,
        args: { gameId: game.id, requestId: s.session.ports.createId() },
      })
    );
  },
});

/** The other person offers a multiplayer rematch and this one accepts it. */
export const acceptOwnBoardRematch = scenarioAction({
  name: 'acceptOwnBoardRematch',
  act: async (s, actor: string) => {
    const offerer = actor === 'alice' ? 'bob' : 'alice';
    await Promise.resolve(
      sendOwnBoardCommand.act(s, offerer, 'offerMultiplayerRematch')
    );
    await Promise.resolve(
      sendOwnBoardCommand.act(s, actor, 'acceptMultiplayerRematch')
    );
  },
});

/** What one person's multiplayer screen shows, in the model's words. */
export type OwnBoardScreen = {
  readonly gameId: string | null;
  readonly moveCount: number;
  /** `ongoing`, `white`, `black`, `draw` or `aborted`, as the screen has it. */
  readonly outcome: string | null;
  readonly playSide: 'White' | 'Black' | 'none';
  /** Moves played to reach the earlier position shown; -1 for the current one. */
  readonly earlierPosition: number;
  readonly boardFacing: 'White' | 'Black' | 'none';
  /** Both the game record and the final position are offered, or neither. */
  readonly gameRecordOffered: boolean | 'one of them';
};

const SIDES = { white: 'White', black: 'Black' } as const;

function sideShown(colour: string | null): OwnBoardScreen['playSide'] {
  if (colour === null) return 'none';
  return colour.endsWith('White') ? 'White' : 'Black';
}

async function ownBoardScreen(
  s: ProductHarness,
  actor: string
): Promise<OwnBoardScreen> {
  const board = await shownMultiplayerBoard(s, actor);
  const offered = await gameRecordOffered(s, actor);
  return {
    gameId: board.gameId,
    moveCount: await shownMultiplayerMoveCount(s, actor),
    outcome: (await multiplayerWatcherBoard(s, actor)).outcome,
    playSide: sideShown((await shownMultiplayerLineup(s, actor)).colour),
    earlierPosition: (await shownEarlierPosition(s, actor)) ?? -1,
    boardFacing: board.facing === null ? 'none' : SIDES[board.facing],
    gameRecordOffered:
      offered.gameRecord === offered.finalPosition
        ? offered.gameRecord
        : 'one of them',
  };
}

/** What each of the three people's screens shows, without acting. */
export async function readOwnBoardScreens(
  s: ProductHarness
): Promise<ReadonlyMap<string, OwnBoardScreen>> {
  const screens = new Map<string, OwnBoardScreen>();
  for (const actor of OWN_BOARD_PEOPLE)
    screens.set(actor, await ownBoardScreen(s, actor));
  return screens;
}
