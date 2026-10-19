import { expect } from 'bun:test';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { copiedGameRecord } from '@libs/chess-root-harness/chess-record-reading';
import {
  bothBoards,
  resignation,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { copyShownMultiplayerText } from '@libs/game-matchmaking-harness/multiplayer-game-record';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';

/** The game record the person copied, as another chess program reads it. */
async function recordCopied(w: HarnessWorld, actor: string) {
  const copiedOn = w.memo.get(`multiplayer:copier:${actor}`);
  const device = typeof copiedOn === 'string' ? copiedOn : viewerOf(w, actor);
  const record = await w.s.read(copiedGameRecord, device);
  if (record === null) throw new Error(`${actor} copied no game record`);
  return record;
}

Given('{actor} has resigned multiplayer chess', async (w, actor: Actor) => {
  expect((await resignation(w, actor)).result.ok).toBe(true);
  await bothBoards(w, (game) => game.reason === 'resignation');
});

When('{actor} copies the game record', async (w, actor: Actor) => {
  const device = viewerOf(w, actor);
  await w.s.apply(openFindingAnOpponent, device, CHESS_GAME_ID);
  await w.s.apply(copyShownMultiplayerText, device, 'game record');
});

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
