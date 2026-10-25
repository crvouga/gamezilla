/**
 * Hands only their own player sees: what each player and watcher is shown
 * of the hands and passes, whenever they arrive or come back.
 */

import { expect } from 'bun:test';
import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import { partition } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { playFirstAllowedHeartsCard } from '@libs/hearts-harness-ts/hearts-actions';
import { secondDealFirstTrick } from '@libs/hearts-harness-ts/hearts-later-deals';
import {
  heartsHandAfter,
  splitCommittedProposal,
} from '@libs/hearts-harness-ts/hearts-lines';
import type { HeartsView } from '@libs/hearts-harness-ts/hearts-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  cardsHeldBy,
  chosen,
  deciding,
  type HeartsWorld,
  hasPassed,
  held,
  pass,
  plan,
  planned,
  plannedLine,
  remember,
  SIDES,
  score,
  seated,
  sees,
  seesOnce,
  shownOf,
  sideOf,
  sorted,
  table,
  trick,
} from './hearts-world';

/** The cards in the trick `view` shows. */
function trickCards(view: HeartsView): readonly string[] {
  return Object.values(trick(view));
}

/** `view` shows how many cards each seat holds, and no card but those in the trick and `own`. */
function seesOnlyCounts(view: HeartsView, own: readonly string[] = []): void {
  for (const side of SIDES) expect(cardsHeldBy(view, side)).toBeGreaterThan(0);
  for (const card of view.cardsOnPage)
    expect([...trickCards(view), ...own]).toContain(card);
}

/** `actor` sees the scores everyone sees, one for each seat. */
async function seesEveryScore(w: HeartsWorld, actor: string, view: HeartsView) {
  const host = await sees(
    w,
    seated(w).white === actor ? seated(w).black : seated(w).white
  );
  for (const side of SIDES) expect(score(view, side)).toBe(score(host, side));
}

Given('{actor} is watching the custom game', (w, actor: string) =>
  plan(w, { watchers: [...(planned(w).watchers ?? []), actor] })
);
Given("{actor} is in {actor}'s space", (w, actor: string, host: string) =>
  plan(w, { host, members: [...(planned(w).members ?? []), actor] })
);
Given('the first trick of the second deal has been played', (w) =>
  plan(w, { line: secondDealFirstTrick() })
);
Given(
  '{actor} passed {heartsCards} before his/her phone went offline',
  async (w, actor: string, cards: string[]) => {
    await table(w);
    await pass(w, actor, cards);
    await w.s.apply(partition, actor);
    await remember(w);
  }
);
Given(
  "{actor}'s phone was offline while {heartsSeat} and {heartsSeat} played their cards",
  async (w, actor: string, ...sides: GameSide[]) => {
    await table(w);
    await w.s.apply(partition, actor);
    for (const side of sides)
      await w.s.apply(playFirstAllowedHeartsCard, seated(w)[side]);
    await remember(w);
  }
);

When('{actor} watches the custom game', async (w, actor: string) => {
  await table(w);
  await w.s.apply(openCustomGames, actor, 'hearts');
});

Then(
  '{actor} sees her/his own 13 cards and how many cards {heartsSeat}, {heartsSeat} and {heartsSeat} hold, but none of their cards',
  async (w, actor: string, ...others: GameSide[]) => {
    const view = await seesOnce(w, actor, (v) => v.hand.length > 0);
    expect(held(view)).toHaveLength(13);
    for (const side of others) expect(cardsHeldBy(view, side)).toBe(13);
    seesOnlyCounts(view, held(view));
  }
);
Then(
  '{actor} sees {heartsCards} in the current trick',
  async (w, actor: string, cards: string[]) => {
    const view = await seesOnce(w, actor, (v) =>
      cards.every((card) => trickCards(v).includes(card))
    );
    expect(sorted(trickCards(view))).toEqual(sorted(cards));
  }
);
Then(
  '{actor} sees how many cards each hand holds, but none of their cards',
  async (w, actor: string) => {
    const view = await sees(w, actor);
    expect(view.hand).toEqual([]);
    seesOnlyCounts(view);
  }
);
Then(
  '{actor} cannot see which cards {heartsSeat} passed',
  async (w, actor: string, side: GameSide) => {
    const passed = chosen(await sees(w, seated(w)[side]));
    expect(passed).toHaveLength(3);
    expect(shownOf(await sees(w, actor), passed)).toEqual([]);
  }
);
Then(
  '{actor} sees the board with every cumulative score',
  async (w, actor: string) => {
    const view = await seesOnce(w, actor, (v) => trickCards(v).length > 0);
    await seesEveryScore(w, actor, view);
  }
);
Then(
  "{actor} cannot see any player's hand or the cards anyone passed",
  async (w, actor: string) => {
    const view = await sees(w, actor);
    expect(view.hand).toEqual([]);
    seesOnlyCounts(view);
    const passes = plannedLine(w).history.filter(
      (proposal) => splitCommittedProposal(proposal) !== null
    );
    for (const part of splitCommittedProposal(passes.at(-1) ?? '') ?? [])
      expect(view.page).not.toContain(part);
  }
);
Then(
  '{actor} sees his/her own hand and that he/she passed {heartsCards}',
  async (w, actor: string, cards: string[]) => {
    const side = sideOf(w, actor);
    const view = await seesOnce(w, actor, (v) => hasPassed(v, side));
    expect(sorted(held(view))).toEqual(
      sorted(heartsHandAfter(plannedLine(w), side).match(/../g) ?? [])
    );
    expect(sorted(chosen(view))).toEqual(sorted(cards));
  }
);
Then(
  '{actor} sees {heartsSeat} has passed but cannot see which cards {heartsSeat} passed',
  async (w, actor: string, side: GameSide) => {
    const view = await seesOnce(w, actor, (v) => hasPassed(v, side));
    const passed = chosen(await sees(w, seated(w)[side]));
    expect(passed).toHaveLength(3);
    expect(shownOf(view, passed)).toEqual([]);
  }
);
Then(
  "{actor} sees his/her own current hand, every cumulative score and that it is {heartsSeat}'s turn",
  async (w, actor: string, turn: GameSide) => {
    const side = sideOf(w, actor);
    const view = await seesOnce(w, actor, (v) => deciding(v) === turn);
    expect(sorted(held(view))).toEqual(
      sorted(heartsHandAfter(plannedLine(w), side).match(/../g) ?? [])
    );
    expect(held(view)).toHaveLength(cardsHeldBy(view, side));
    await seesEveryScore(w, actor, view);
  }
);
Then(
  '{actor} sees his/her own current hand, every cumulative score and whose turn it is',
  async (w, actor: string) => {
    const side = sideOf(w, actor);
    const dealt = heartsHandAfter(plannedLine(w), side).match(/../g) ?? [];
    const view = await seesOnce(w, actor, (v) => v.screen.connected);
    expect(held(view)).toHaveLength(cardsHeldBy(view, side));
    for (const card of held(view)) expect(dealt).toContain(card);
    const others = await sees(w, seated(w).white);
    expect(deciding(view)).not.toBeNull();
    expect(deciding(view)).toBe(deciding(others));
    await seesEveryScore(w, actor, view);
  }
);
Then("{actor} sees no other player's hand", async (w, actor: string) => {
  const view = await sees(w, actor);
  seesOnlyCounts(view, held(view));
});
