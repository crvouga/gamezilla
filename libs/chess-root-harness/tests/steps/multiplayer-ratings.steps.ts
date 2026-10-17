import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { pairOf } from '@libs/game-matchmaking-harness/matched-game-world';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';

async function shownGames(w: HarnessWorld, actor: string, speed: string) {
  await w.s.apply(openMultiplayerChess, actor);
  return (
    await w.s.read(
      shownMultiplayerText,
      actor,
      `multiplayer-rating-${speed}-games`
    )
  )?.trim();
}

Then(
  '{actor} still has {int} rated multiplayer game at {word}',
  async (w, actor: Actor, games: number, speed: string) => {
    expect(await shownGames(w, actor, speed)).toBe(
      `${String(games)} rated game${games === 1 ? '' : 's'}`
    );
  }
);
Then("neither person's {word} rating has moved", async (w, speed: string) => {
  for (const actor of pairOf(w)) {
    const view = await w.s.read(multiplayerView, actor);
    expect(view.game?.white_rating_diff ?? null).toBeNull();
    expect(view.game?.black_rating_diff ?? null).toBeNull();
    const blitz = view.ratings.find((r) => r.speed === speed);
    expect(blitz?.games ?? 0).toBe(0);
  }
});
