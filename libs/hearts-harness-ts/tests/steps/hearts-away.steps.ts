/**
 * A stand-in for a person who is away: it passes and plays from their own
 * hand, and they take their side back when they return.
 */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  letStandInPass,
  letStandInPlay,
  stayOffline,
  takeBackHeartsSide,
} from '@libs/hearts-harness-ts/hearts-actions';
import {
  STAND_IN_FIRST_TWO_TRICKS,
  TRICK_TABLE,
} from '@libs/hearts-harness-ts/hearts-tables';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  held,
  plan,
  planned,
  remembered,
  seated,
  sees,
  seesOnce,
  table,
} from './hearts-world';

const SECOND_MS = 1000;

Given(
  "{actor}'s phone has been offline for {int} seconds",
  async (w, actor: string, seconds: number) => {
    await table(w);
    // What everyone saw before going offline stays the view to compare with.
    await w.s.apply(stayOffline, actor, seconds * SECOND_MS);
  }
);
Given('a stand-in is playing {heartsSeat} for {actor}', (w, side: GameSide) =>
  plan(w, { away: side })
);
Given(
  "a stand-in is playing {heartsSeat} for {actor} and it is {heartsSeat}'s turn",
  (w, side: GameSide) =>
    plan(w, {
      away: side,
      table: planned(w).table ?? TRICK_TABLE,
      stage: 'south led',
    })
);
Given(
  "a stand-in has played {heartsSeat}'s cards for {actor} in the first two tricks",
  (w, side: GameSide) =>
    plan(w, {
      away: side,
      table: TRICK_TABLE,
      stage: 'passed',
      then: STAND_IN_FIRST_TWO_TRICKS,
    })
);
Given('{actor} is back online', (w) => plan(w, { back: true }));

When(
  "{actor}'s stand-in passes for {heartsSeat}",
  async (w, _actor: string, side: GameSide) => {
    await table(w);
    await w.s.apply(letStandInPass, seated(w).white, side);
  }
);
When(
  "{actor}'s stand-in plays for {heartsSeat}",
  async (w, _actor: string, side: GameSide) => {
    await table(w);
    await w.s.apply(letStandInPlay, seated(w).white, side);
  }
);
When('{actor} takes back his/her side', async (w, actor: string) => {
  await table(w);
  await w.s.apply(takeBackHeartsSide, actor);
});

Then(
  "three cards from {heartsSeat}'s hand are passed to {heartsSeat}",
  async (w, giver: GameSide, receiver: GameSide) => {
    const person = seated(w)[receiver];
    const before = held(remembered(w, person));
    const view = await seesOnce(w, person, (v) =>
      held(v).some((card) => !before.includes(card))
    );
    const received = held(view).filter((card) => !before.includes(card));
    expect(received).toHaveLength(3);
    const givers = held(remembered(w, seated(w)[giver]));
    for (const card of received) expect(givers).toContain(card);
  }
);
Then(
  '{actor}, {actor} and {actor} see a stand-in playing {heartsSeat} for {actor}',
  async (w, ...named: string[]) => {
    const side = named[3] as GameSide;
    const person = named[4]!;
    const id = (await sees(w, person)).screen.me;
    for (const actor of named.slice(0, 3)) {
      const view = await seesOnce(w, actor, (v) => v.standIns.includes(side));
      expect(view.standIns).toContain(side);
      expect(view.screen.current?.[side].person).toBe(id);
    }
  }
);
