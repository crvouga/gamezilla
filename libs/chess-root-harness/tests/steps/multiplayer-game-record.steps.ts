import { expect } from 'bun:test';
import {
  copiedGameRecord,
  copyGameRecord,
} from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import {
  bothBoards,
  resignation,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
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

When('{actor} copies the game record', (w, actor: Actor) =>
  w.s.apply(copyGameRecord, viewerOf(w, actor))
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
