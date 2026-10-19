import { expect } from 'bun:test';
import {
  multiplayerText,
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';
import { otherDevice, readyPeople, seenOn } from './matched-game';

/**
 * Controls the person's finding an opponent does not offer, once it shows
 * their matched game (or, without one, the choices to seek one).
 */
async function notOffered(
  w: HarnessWorld,
  actor: string,
  controls: readonly string[]
) {
  const device = seenOn(w, actor);
  const shows =
    (await w.s.read(multiplayerView, device)).game === null
      ? 'multiplayer-find'
      : 'multiplayer-game';
  await w.s.until((s) => multiplayerText(s, device, shows), {
    pred: (text) => text !== null,
  });
  for (const control of controls)
    expect(await w.s.read(shownMultiplayerText, device, control)).toBeNull();
}

Given(
  '{actor} has a free account and has never had a matched game',
  (w, actor: string) => readyPeople(w, [actor])
);

When('{actor} opens finding an opponent', async (w, actor: string) => {
  await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
});
When(
  '{actor} opens finding an opponent on another device',
  async (w, actor: string) => {
    const device = await otherDevice(w, actor);
    await w.s.apply(openFindingAnOpponent, device, gameOf(w).shared.id);
  }
);

Then('{actor} cannot resign, abort or offer a draw', (w, actor: string) =>
  notOffered(w, actor, [
    'multiplayer-resign',
    'multiplayer-abort',
    'multiplayer-offer-draw',
  ])
);
Then(
  '{actor} cannot find a new opponent or offer a rematch',
  (w, actor: string) =>
    notOffered(w, actor, [
      'multiplayer-new-opponent',
      'multiplayer-offer-rematch',
    ])
);
