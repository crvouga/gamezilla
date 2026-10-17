import { expect } from 'bun:test';
import {
  confirmMultiplayerCommand,
  findChessOpponent,
  moveMultiplayerPiece,
  openMultiplayerChess,
  pressMultiplayerControl,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  bothBoards,
  matchedGameOf,
  pairOf,
  sameBoards,
  searchFor,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then, When } from '@libs/harness/define';
import { actorHtml } from '@libs/harness/observations';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';
import { givenBegunGame, givenGame, givenOverGame } from './multiplayer-world';

/** What the person hears: the screen's live announcement, once it says `phrase`. */
async function hears(w: HarnessWorld, actor: string, phrase: string) {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(async (s) =>
    (
      (await shownMultiplayerText(s, actor, 'multiplayer-announcement')) ?? ''
    ).includes(phrase)
  );
  expect(
    await w.s.read(shownMultiplayerText, actor, 'multiplayer-announcement')
  ).toContain(phrase);
}

Given(
  '{actor} has an account and is using the keyboard alone',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
  }
);
Given(
  '{actor} is White after e4 and e5 in a {word} multiplayer game and is using the keyboard alone',
  (w, actor: Actor, timeControl: string) =>
    givenBegunGame(w, actor, 'bob', timeControl)
);
Given(
  '{actor} is White in a new multiplayer game and is using the keyboard alone',
  (w, actor: Actor) => givenGame(w, actor, 'bob')
);
Given(
  '{actor} is White in a new multiplayer game and is listening to the app',
  (w, actor: Actor) => givenGame(w, actor, 'bob')
);
Given(
  '{actor} is listening to her unfinished multiplayer game with {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    await givenGame(w, actor, opponent);
    await w.s.apply(openMultiplayerChess, actor);
  }
);
Given(
  '{actor} is using the keyboard alone after her {word} multiplayer game with {actor} is over',
  (w, actor: Actor, timeControl: string, opponent: Actor) =>
    givenOverGame(w, actor, opponent, timeControl)
);
Given(
  '{actor} is listening to the app while looking for a {word} chess opponent',
  async (w, actor: Actor, timeControl: string) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, timeControl);
    await w.s.apply(openMultiplayerChess, actor);
  }
);
Given(
  '{actor} is listening to the app after her {word} multiplayer game with {actor} is over',
  async (w, actor: Actor, timeControl: string, opponent: Actor) => {
    await givenOverGame(w, actor, opponent, timeControl);
    await w.s.apply(openMultiplayerChess, actor);
  }
);
Given(
  '{actor} is listening to her {word} multiplayer game with {actor} after e4 and e5',
  async (w, actor: Actor, timeControl: string, opponent: Actor) => {
    await givenBegunGame(w, actor, opponent, timeControl);
    await w.s.apply(openMultiplayerChess, actor);
  }
);
When(
  '{actor} finds a chess opponent for {word} with the keyboard',
  async (w, actor: Actor, timeControl: string) => {
    w.memo.set('multiplayer:acted', true);
    await w.s.apply(findChessOpponent, actor, timeControl, true);
  }
);
When(
  '{actor} plays {word} to {word} as a multiplayer move with the keyboard',
  async (w, actor: Actor, from: string, to: string) => {
    const before = (await matchedGameOf(w, actor)).revision;
    await w.s.apply(moveMultiplayerPiece, actor, from + to, true);
    await bothBoards(w, (g) => g.revision === before + 1);
  }
);
When(
  '{actor} aborts the multiplayer game with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(confirmMultiplayerCommand, actor, 'abort', true);
  }
);
When(
  '{actor} offers a multiplayer draw with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(
      pressMultiplayerControl,
      actor,
      'multiplayer-offer-draw',
      true
    );
  }
);
When(
  '{actor} offers a multiplayer rematch with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(
      pressMultiplayerControl,
      actor,
      'multiplayer-offer-rematch',
      true
    );
  }
);
Then(
  '{actor} can resign multiplayer chess with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(confirmMultiplayerCommand, actor, 'resign', true);
    expect(
      (await sameBoards(w, actor, 'bob', (g) => g.outcome !== 'ongoing')).reason
    ).toBe('resignation');
  }
);
Then(
  '{actor} hears she is White and has the multiplayer turn',
  async (w, actor: Actor) => {
    await hears(w, actor, 'You are White');
    await hears(w, actor, 'Your turn');
  }
);
Then(
  '{actor} hears what every multiplayer control does',
  async (w, actor: Actor) => {
    for (const [id, label] of [
      ['multiplayer-abort', 'Abort the multiplayer game'],
      ['multiplayer-offer-draw', 'Offer a multiplayer draw'],
    ] as const)
      expect(await w.s.read(shownMultiplayerText, actor, id)).toContain(label);
    const html = await w.s.read(actorHtml, actor);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-label=');
  }
);
Then(
  '{actor} hears she was matched with {actor}, his blitz rating, the time control and her colour',
  async (w, actor: Actor, opponent: Actor) => {
    const control = String(w.memo.get(`multiplayer:searching:${actor}`));
    await hears(
      w,
      actor,
      `Matched with ${opponent}, rated 1500?, at ${control}.`
    );
    await hears(w, actor, 'You are');
  }
);
Then(
  '{actor} hears the time left on both multiplayer clocks',
  async (w, actor: Actor) => {
    await w.s.apply(openMultiplayerChess, actor);
    const html = (await w.s.read(actorHtml, actor)) ?? '';
    expect(html).toContain('White has 5:00 left');
    expect(html).toContain('Black has 5:00 left');
  }
);
Then(
  '{actor} hears {actor} offered her a multiplayer draw',
  (w, actor: Actor, opponent: Actor) =>
    hears(w, actor, `${opponent} offered you a multiplayer draw.`)
);
Then(
  '{actor} hears {actor} offered her a multiplayer rematch',
  (w, actor: Actor, opponent: Actor) =>
    hears(w, actor, `${opponent} offered you a multiplayer rematch.`)
);
Then('{actor} hears the multiplayer game was aborted', (w, actor: Actor) =>
  hears(w, actor, 'The multiplayer game was aborted.')
);
Then('{actor} hears she won the multiplayer game', async (w, actor: Actor) => {
  const [, opponent] = pairOf(w);
  await sameBoards(w, actor, opponent, (g) => g.outcome !== 'ongoing');
  await hears(w, actor, 'You won');
});
