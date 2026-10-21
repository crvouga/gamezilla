/**
 * Watching a matched game from either of its people's spaces, whichever
 * game it is: guests see the same board, moves and clocks as its people,
 * watching gives no side, and a move from a person's other device is in
 * the game once.
 */

import { expect } from 'bun:test';
import {
  bothBoards,
  move,
  pairOf,
  refusal,
  sameBoards,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import {
  joinMultiplayerSpace,
  multiplayerBoardShown,
} from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import {
  multiplayerText,
  multiplayerView,
  shownMultiplayerClock,
} from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { actorUi } from '@libs/harness-ts/actor-ui';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  actOnOtherDevice,
  firstMoveOf,
  otherDevice,
  pairedAt,
  told,
} from './matched-game';
import { openOn } from './matched-game-shown.steps';

/** What a watcher's screen shows of the matched game and their part in it. */
export async function watcherBoard(s: ProductHarness, actor: string) {
  const board = await multiplayerBoardShown(s, actor);
  const ui = await actorUi(s, actor);
  return {
    ...board,
    canResign: await ui.get('multiplayer-resign').isVisible(),
    announcement: await multiplayerText(s, actor, 'multiplayer-announcement'),
  };
}

/** `watcher` sees the matched game but cannot make a move or resign in it. */
export async function onlyWatches(w: HarnessWorld, watcher: string) {
  await w.s.until((s) => watcherBoard(s, watcher), {
    pred: (board) => board.gameId !== null,
  });
  const board = await w.s.read(watcherBoard, watcher);
  expect(board.announcement ?? '').toContain('Watching');
  expect(board.canMove).toBe(false);
  expect(board.boardTakesMoves).toBe(false);
  expect(board.canResign).toBe(false);
}

/** `watcher`'s board shows the position the matched game has after its first move. */
async function seesFirstMove(w: HarnessWorld, watcher: string) {
  const played = await bothBoards(w, (game) => game.revision === 1);
  await w.s.until((s) => multiplayerBoardShown(s, watcher), {
    pred: (board) => board.revision === 1 && board.fen === played.fen,
  });
  const board = await w.s.read(multiplayerBoardShown, watcher);
  expect([board.gameId, board.fen]).toEqual([played.id, played.fen]);
}

/** The person's other device, holding their matched game. */
async function deviceWithGame(w: HarnessWorld, person: string) {
  const device = await otherDevice(w, person);
  await w.s.until(async (s) => (await multiplayerView(s, device)).game, {
    pred: (game) => game !== null,
    maxMs: 20_000,
  });
  return device;
}

When(
  "{actor} joins {actor}'s space",
  async (w, watcher: string, host: string) => {
    await openOn(w, host);
    await w.s.apply(joinMultiplayerSpace, watcher, host);
  }
);

Then("{actor} sees {actor}'s first move on the board", (w, watcher: string) =>
  seesFirstMove(w, watcher)
);
Then(
  "{actor} and {actor} see {actor}'s first move on the board",
  async (w, first: string, second: string) => {
    await seesFirstMove(w, first);
    await seesFirstMove(w, second);
  }
);
Then(
  '{actor} and {actor} cannot make a move',
  async (w, first: string, second: string) => {
    await onlyWatches(w, first);
    await onlyWatches(w, second);
  }
);
Then('{actor} is told only the matched people can move', (w, actor: string) =>
  refusal(w, actor, 'CHESS_MATCHED_ONLY')
);
Then('{actor} is told finding an opponent needs a space', (w, actor: string) =>
  told(w, actor, 'CHESS_SPACE_REQUIRED')
);
Then('{actor} no longer sees the matched game', async (w, actor: string) => {
  await w.s.until(async (s) => (await multiplayerBoardShown(s, actor)).gameId, {
    pred: (gameId) => gameId === null,
  });
  expect((await w.s.read(multiplayerBoardShown, actor)).gameId).toBeNull();
});

Then(
  "{actor}, {actor} and {actor} see {int} seconds on the first side's clock and {int} seconds on the second side's",
  async (
    w,
    ...[a, b, c, first, second]: [string, string, string, number, number]
  ) => {
    for (const person of [a, b, c]) {
      await openOn(w, person);
      const clocks = async (s: ProductHarness) => [
        await shownMultiplayerClock(s, person, 'white'),
        await shownMultiplayerClock(s, person, 'black'),
      ];
      await w.s.until(clocks, {
        pred: (shown) => shown[0] === first && shown[1] === second,
        maxMs: 500,
      });
      expect(await w.s.read(clocks)).toEqual([first, second]);
    }
  }
);

When(
  '{actor} makes her first move on her other device',
  async (w, actor: string) => {
    const device = await deviceWithGame(w, actor);
    actOnOtherDevice(w, actor, device);
    await openOn(w, device);
    await move(w, device, firstMoveOf(w, actor));
  }
);
Given(
  "{actor}'s first move was accepted from her other device",
  async (w, actor: string) => {
    await pairedAt(w, actor, 'bob');
    const device = await deviceWithGame(w, actor);
    await openOn(w, device);
    expect((await move(w, device, firstMoveOf(w, actor))).result.ok).toBe(true);
    const [first, second] = pairOf(w);
    expect(
      (await sameBoards(w, first, second, (game) => game.revision === 1))
        .revision
    ).toBe(1);
  }
);
When(
  '{actor} makes her first move again on her phone',
  async (w, actor: string) => {
    // The phone shows the move its other device made: it is a new board.
    await w.s.until(async (s) => (await multiplayerView(s, actor)).game, {
      pred: (game) => game?.revision === 1,
    });
    await openOn(w, actor);
    await move(w, actor, firstMoveOf(w, actor));
  }
);
