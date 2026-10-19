/**
 * Finding an opponent and a matched game with the keyboard alone, and what
 * a person listening to the app hears of them: who they were paired with,
 * their side as the game names it, the clocks, offers and the result.
 */

import { expect } from 'bun:test';
import {
  ownerOf,
  pairOf,
  sameBoards,
} from '@libs/game-matchmaking-harness/matched-game-world';
import {
  confirmWithKeyboard,
  pressControlWithKeyboard,
  seekOpponentWithKeyboard,
} from '@libs/game-matchmaking-harness/multiplayer-keyboard';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import { actorHtml } from '@libs/harness/observations';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { nameEveryoneSeesOf } from '@libs/profile-harness/profile-ui-reads';
import { clockShown, seeking } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import {
  finishedAt,
  firstMoves,
  pairedAt,
  readyPeople,
  timeControlFor,
} from './matched-game';

function open(w: HarnessWorld, actor: string) {
  return w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
}

/** How the game names `side` to a person. */
function sideName(w: HarnessWorld, side: 'white' | 'black'): string {
  const presentation = gameOf(w).client.presentation;
  if (presentation === undefined)
    throw new Error(`${gameOf(w).label} has no board to name its sides`);
  return presentation.sideLabel(side);
}

/** What the person hears: the screen's live announcement, once it says all of `phrases`. */
async function hears(
  w: HarnessWorld,
  actor: string,
  ...phrases: readonly string[]
) {
  await open(w, actor);
  const says = (shown: string | null) =>
    phrases.every((phrase) => (shown ?? '').includes(phrase));
  await w.s.until(
    (s) => shownMultiplayerText(s, actor, 'multiplayer-announcement'),
    { pred: says }
  );
  expect(
    says(
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-announcement')
    )
  ).toBe(true);
}

/** The side `actor` plays in their matched game. */
async function sideOf(w: HarnessWorld, actor: string) {
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game === null) throw new Error(`${actor} has no matched game`);
  return game.white_id === (await ownerOf(w, actor)) ? 'white' : 'black';
}

async function nameOf(w: HarnessWorld, person: string): Promise<string> {
  return String(await w.s.read(nameEveryoneSeesOf, person));
}

Given(
  '{actor} has an account and is using the keyboard alone',
  (w, actor: string) => readyPeople(w, [actor])
);
Given(
  '{actor} has the first side against {actor} in a {word} matched game after their first moves and is using the keyboard alone',
  async (w, first: string, second: string, clock: string) => {
    await pairedAt(w, first, second, clock);
    await firstMoves(w);
  }
);
Given(
  '{actor} has the first side against {actor} in a new matched game and is using the keyboard alone',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
  }
);
Given(
  '{actor} is using the keyboard alone after her {word} matched game with {actor} is finished',
  (w, first: string, clock: string, second: string) =>
    finishedAt(w, first, second, clock)
);
Given(
  '{actor} is listening to the app while seeking an opponent for the game at {word}',
  async (w, actor: string, clock: string) => {
    await seeking(w, actor, clock);
    w.memo.set(`matched-game:sought:${actor}`, clock);
    await open(w, actor);
  }
);
Given(
  '{actor} has the first side against {actor} in a new matched game and is listening to the app',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    await open(w, first);
  }
);
Given(
  '{actor} is listening to her unfinished matched game with {actor}',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    await open(w, first);
  }
);
Given(
  '{actor} is listening to the app after her {word} matched game with {actor} is finished',
  async (w, first: string, clock: string, second: string) => {
    await finishedAt(w, first, second, clock);
    await open(w, first);
  }
);

When(
  '{actor} seeks an opponent for the game at {word} with the keyboard alone',
  (w, actor: string, clock: string) =>
    w.s.apply(
      seekOpponentWithKeyboard,
      actor,
      gameOf(w).shared.id,
      timeControlFor(w, clock)
    )
);
When(
  '{actor} resigns the matched game with the keyboard alone',
  (w, actor: string) =>
    w.s.apply(confirmWithKeyboard, actor, gameOf(w).shared.id, 'resign')
);
When(
  '{actor} aborts the matched game with the keyboard alone',
  (w, actor: string) =>
    w.s.apply(confirmWithKeyboard, actor, gameOf(w).shared.id, 'abort')
);
When('{actor} offers a draw with the keyboard alone', (w, actor: string) =>
  w.s.apply(
    pressControlWithKeyboard,
    actor,
    gameOf(w).shared.id,
    'multiplayer-offer-draw'
  )
);
When('{actor} offers a rematch with the keyboard alone', (w, actor: string) =>
  w.s.apply(
    pressControlWithKeyboard,
    actor,
    gameOf(w).shared.id,
    'multiplayer-offer-rematch'
  )
);

Then(
  '{actor} hears she was paired with {actor}, his blitz rating, the clock choice and her side',
  async (w, actor: string, opponent: string) => {
    const clock = String(w.memo.get(`matched-game:sought:${actor}`));
    await hears(
      w,
      actor,
      `Matched with ${await nameOf(w, opponent)}, rated 1500?, at ${clockShown(clock)}.`
    );
    await hears(w, actor, `You are ${sideName(w, await sideOf(w, actor))}.`);
  }
);
Then(
  '{actor} hears she has the first side and the turn',
  async (w, actor: string) => {
    expect(await sideOf(w, actor)).toBe('white');
    await hears(w, actor, `You are ${sideName(w, 'white')}.`, 'Your turn');
  }
);
Then(
  '{actor} hears what every control of the matched game does',
  async (w, actor: string) => {
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
Then('{actor} hears the time left on both clocks', async (w, actor: string) => {
  await open(w, actor);
  const html = (await w.s.read(actorHtml, actor)) ?? '';
  expect(html).toContain(`${sideName(w, 'white')} has 5:00 left`);
  expect(html).toContain(`${sideName(w, 'black')} has 5:00 left`);
});
Then(
  '{actor} hears {actor} offered her a draw',
  async (w, actor: string, opponent: string) =>
    hears(
      w,
      actor,
      `${await nameOf(w, opponent)} offered you a multiplayer draw.`
    )
);
Then(
  '{actor} hears {actor} offered her a rematch',
  async (w, actor: string, opponent: string) =>
    hears(
      w,
      actor,
      `${await nameOf(w, opponent)} offered you a multiplayer rematch.`
    )
);
Then('{actor} hears the matched game was aborted', (w, actor: string) =>
  hears(w, actor, 'The multiplayer game was aborted.')
);
Then('{actor} hears she won the matched game', async (w, actor: string) => {
  const [first, second] = pairOf(w);
  await sameBoards(w, first, second, (g) => g.outcome !== 'ongoing');
  await hears(w, actor, 'You won');
});
