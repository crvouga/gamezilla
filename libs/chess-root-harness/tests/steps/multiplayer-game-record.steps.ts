import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  copiedGameRecord,
  copiedMultiplayerText,
  copyFinalPosition,
  copyGameRecord,
  gameRecordOffered,
} from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import {
  acceptedMoves,
  bothBoards,
  gameCommand,
  ownerOf,
  resignation,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { standInNameOf } from '@libs/profile-harness/profile-ui-reads';
import { PIECES_AFTER } from './multiplayer-own-board-world';
import { givenGame } from './multiplayer-world';

/** The game record the person copied, as another chess program reads it. */
async function recordCopied(w: HarnessWorld, actor: string) {
  const copiedOn = w.memo.get(`multiplayer:copier:${actor}`);
  const device = typeof copiedOn === 'string' ? copiedOn : viewerOf(w, actor);
  const record = await w.s.read(copiedGameRecord, device);
  if (record === null) throw new Error(`${actor} copied no game record`);
  return record;
}

/** The name the copied game record gives the person, by their colour. */
async function nameGiven(w: HarnessWorld, copier: string, person: string) {
  const record = await recordCopied(w, copier);
  const white = (await bothBoards(w)).white_id === (await ownerOf(w, person));
  return white ? record.white : record.black;
}

async function offered(w: HarnessWorld, person: string, expected: boolean) {
  const actor = viewerOf(w, person);
  await w.s.apply(openMultiplayerChess, actor, (await bothBoards(w)).id);
  const wanted = { gameRecord: expected, finalPosition: expected };
  await w.s.until((s) => gameRecordOffered(s, actor), {
    pred: (shown) =>
      shown.gameRecord === expected && shown.finalPosition === expected,
  });
  expect(await w.s.read(gameRecordOffered, actor)).toEqual(wanted);
}

Given(
  "{actor}'s {word} multiplayer game with {actor} was aborted after e4",
  async (w, white: Actor, timeControl: string, black: Actor) => {
    await givenGame(w, white, black, timeControl);
    await acceptedMoves(w, ['e2e4']);
    expect((await gameCommand(w, black, 'abortMultiplayer')).result.ok).toBe(
      true
    );
    await bothBoards(w, (game) => game.outcome === 'aborted');
  }
);
Given('{actor} has resigned multiplayer chess', async (w, actor: Actor) => {
  expect((await resignation(w, actor)).result.ok).toBe(true);
  await bothBoards(w, (game) => game.reason === 'resignation');
});

When('{actor} copies the game record', (w, actor: Actor) =>
  w.s.apply(copyGameRecord, viewerOf(w, actor))
);
When('{actor} copies the final position', (w, actor: Actor) =>
  w.s.apply(copyFinalPosition, viewerOf(w, actor))
);

Then(
  '{actor} is offered the game record and the final position',
  (w, actor: Actor) => offered(w, actor, true)
);
Then(
  '{actor} is not offered the game record or the final position',
  (w, actor: Actor) => offered(w, actor, false)
);
Then(
  'the final position {actor} copied is the position after e5 with White to move',
  async (w, actor: Actor) => {
    const copied = await w.s.read(copiedMultiplayerText, viewerOf(w, actor));
    expect(copied?.split(' ').slice(0, 2)).toEqual([PIECES_AFTER['e5']!, 'w']);
  }
);
Then(
  'the game record {actor} copied names {actor} as White and {actor} as Black',
  async (w, actor: Actor, white: Actor, black: Actor) => {
    expect(await recordCopied(w, actor)).toMatchObject({ white, black });
  }
);
Then(
  'the game record {actor} copied gives the multiplayer result as {word}, the time control as {word} and the moves as {string}',
  async (
    w,
    ...[actor, result, timeControl, moves]: [Actor, string, string, string]
  ) => {
    expect(await recordCopied(w, actor)).toMatchObject({
      result,
      timeControl,
      moves,
    });
  }
);
Then(
  'the game record {actor} copied can be opened in another chess program',
  async (w, actor: Actor) => {
    expect((await recordCopied(w, actor)).opens).toBe(true);
  }
);
Then(
  'the game record {actor} copied names {actor} as {username}',
  async (w, actor: Actor, person: Actor, username: string) => {
    expect(await nameGiven(w, actor, person)).toBe(username);
  }
);
Then(
  'the game record {actor} copied names {actor} by her stand-in name',
  async (w, actor: Actor, person: Actor) => {
    const standIn = await w.s.read(standInNameOf, person);
    if (standIn === null) throw new Error(`${person} has no profile yet`);
    expect(await nameGiven(w, actor, person)).toBe(standIn);
  }
);
