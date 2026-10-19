import { expect } from 'bun:test';
import {
  pairOf,
  searchFor,
  viewerOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerRatingAt,
  multiplayerView,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then } from '@libs/harness/define';
import { gameOf } from './game-world';
import { otherDevice, readyPeople, timeControlFor, told } from './matched-game';

Given(
  '{actor} has the first side against {actor} in a new {word} matched game and her phone has been offline since they were paired',
  async (w, first: string, second: string, clock: string) => {
    await readyPeople(w, [first, second]);
    // Her other device stays online: what she sees is read there.
    w.memo.set(`multiplayer:viewer:${first}`, await otherDevice(w, first));
    await searchFor(w, first, timeControlFor(w, clock));
    await w.s.advanceTime(1);
    await searchFor(w, second, timeControlFor(w, clock));
    await w.s.apply(setMultiplayerConnection, first, false);
    await w.s.apply(pairGameOpponents, first, true);
    w.memo.set('multiplayer:pair', [first, second]);
    const game = await w.s.until(
      async (s) => (await multiplayerView(s, second)).game,
      { pred: (seen) => seen !== null }
    );
    w.memo.set('multiplayer:game', game);
  }
);

Then(
  "neither person's {word} rating has changed",
  async (w, speed: Parameters<typeof multiplayerRatingAt>[3]) => {
    const namespace = gameOf(w).shared.turnGame.capabilities.matchmaking!;
    for (const person of pairOf(w)) {
      const viewer = viewerOf(w, person);
      const game = (await w.s.read(multiplayerView, viewer)).game;
      expect(game?.white_rating_diff ?? null).toBeNull();
      expect(game?.black_rating_diff ?? null).toBeNull();
      const rating = await w.s.read(
        multiplayerRatingAt,
        viewer,
        namespace.clockNamespace,
        speed
      );
      expect(rating?.games ?? 0).toBe(0);
    }
  }
);
Then(
  '{actor} is told the matched game can no longer be aborted',
  (w, actor: string) => told(w, actor, 'CHESS_ABORT_TOO_LATE')
);
Then('{actor} is told to abort the matched game instead', (w, actor: string) =>
  told(w, actor, 'CHESS_ABORT_INSTEAD')
);
