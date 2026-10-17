import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { pairOf } from '@libs/game-matchmaking-harness/matched-game-world';
import { givenMultiplayerRating } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { MULTIPLAYER_SETTLED_GAMES } from '@libs/game-matchmaking-shared/multiplayer-rating';
import type { MultiplayerSpeed } from '@libs/game-matchmaking-shared/time-control';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';
import { givenBegunGame } from './multiplayer-world';

/** A settled rating: enough rated games at its speed to have lost the "?". */
export async function settledRating(
  w: HarnessWorld,
  actor: string,
  speed: MultiplayerSpeed,
  rating: number
) {
  await multiplayerPeople(w, [actor]);
  await w.s.apply(givenMultiplayerRating, actor, speed, {
    rating,
    games: MULTIPLAYER_SETTLED_GAMES,
  });
}

/** The rating a person sees for one speed on their multiplayer screen (`1500?`). */
async function shownRating(w: HarnessWorld, actor: string, speed: string) {
  await w.s.apply(openMultiplayerChess, actor);
  return (
    (await w.s.read(
      shownMultiplayerText,
      actor,
      `multiplayer-rating-${speed}-value`
    )) ?? ''
  ).trim();
}

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

/** Waits for the person's screen to show a rating that satisfies `ok`. */
async function ratingUntil(
  w: HarnessWorld,
  actor: string,
  speed: string,
  ok: (shown: string) => boolean
) {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(async (s) =>
    ok(
      (
        (await shownMultiplayerText(
          s,
          actor,
          `multiplayer-rating-${speed}-value`
        )) ?? ''
      ).trim()
    )
  );
  return shownRating(w, actor, speed);
}

const points = (shown: string) => Number(shown.replace('?', ''));

Given(
  '{actor} has a blitz rating of {int}',
  (w, actor: Actor, rating: number) => settledRating(w, actor, 'blitz', rating)
);
Given(
  '{actor} has a rapid rating of {int}',
  (w, actor: Actor, rating: number) => settledRating(w, actor, 'rapid', rating)
);
Given(
  '{actor} has a blitz rating of {int} and a rapid rating of {int}',
  async (w, actor: Actor, blitz: number, rapid: number) => {
    await settledRating(w, actor, 'blitz', blitz);
    await settledRating(w, actor, 'rapid', rapid);
  }
);
Given(
  "{actor}'s blitz rating is one rated multiplayer game from settling",
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await w.s.apply(givenMultiplayerRating, actor, 'blitz', {
      rating: 1500,
      games: MULTIPLAYER_SETTLED_GAMES - 1,
    });
  }
);
Given(
  '{actor} and {actor} have new accounts and a {word} multiplayer game after e4 and e5',
  (w, a: Actor, b: Actor, timeControl: string) =>
    givenBegunGame(w, a, b, timeControl)
);
Then(
  '{actor} sees her blitz rating without the "?"',
  async (w, actor: Actor) => {
    expect(
      await ratingUntil(
        w,
        actor,
        'blitz',
        (shown) => shown !== '' && !shown.endsWith('?')
      )
    ).not.toContain('?');
  }
);
Then(
  '{actor}\'s blitz rating is still shown with the "?"',
  async (w, actor: Actor) => {
    expect(await shownRating(w, actor, 'blitz')).toEndWith('?');
  }
);
Then(
  '{actor} sees her {word} rating rise above {int}',
  async (w, actor: Actor, speed: string, base: number) => {
    const shown = await ratingUntil(w, actor, speed, (r) => points(r) > base);
    expect(points(shown)).toBeGreaterThan(base);
    w.memo.set('multiplayer:rating-rise', points(shown) - base);
  }
);
Then(
  '{actor} sees his blitz rating fall below {int} by the same amount',
  async (w, actor: Actor, base: number) => {
    const shown = await ratingUntil(w, actor, 'blitz', (r) => points(r) < base);
    expect(base - points(shown)).toBe(
      Number(w.memo.get('multiplayer:rating-rise'))
    );
  }
);
export async function stillRated(
  w: HarnessWorld,
  actor: string,
  speed: string,
  rating: number
) {
  expect(points(await shownRating(w, actor, speed))).toBe(rating);
}
Then(
  "{actor}'s blitz rating is still {int}",
  (w, actor: Actor, rating: number) => stillRated(w, actor, 'blitz', rating)
);
Then(
  "{actor}'s rapid rating is still {int}",
  (w, actor: Actor, rating: number) => stillRated(w, actor, 'rapid', rating)
);
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
