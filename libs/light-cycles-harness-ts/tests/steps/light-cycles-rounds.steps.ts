import { expect } from 'bun:test';
import { Given, Step, Then, When } from '@libs/harness-ts/define';
import { settingUp } from '@libs/harness-ts/spec-world';
import type { LightCyclesRiderName } from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  arenaShown,
  bannersShown,
  roundWinsShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import {
  crashRiders,
  reachRoundCountdown,
  winRound,
} from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { arrangeRoundWins } from '@libs/light-cycles-harness-ts/light-cycles-round-actions';
import { onStartingCells } from '@libs/light-cycles-harness-ts/light-cycles-starting-cells';

/** The round result shows for 2 seconds; everyone sees it within that. */
const RESULT_MS = 2000;

Given(
  'the {lightCyclesRound} round is counting down with {int} seconds left',
  async (w, round: number, seconds: number) => {
    await w.s.apply(reachRoundCountdown, round);
    expect((await w.s.read(arenaShown)).overlay).toStartWith(String(seconds));
  }
);
Then(
  '{lightCyclesRiders} are riding from their starting cells',
  async (w, riders: LightCyclesRiderName[]) => {
    expect(await w.s.read(onStartingCells, riders, 'set off')).toBe(true);
  }
);
Then(
  '{lightCyclesRiders} are (still )on their starting cells',
  async (w, riders: LightCyclesRiderName[]) => {
    expect(await w.s.read(onStartingCells, riders, 'waiting')).toBe(true);
  }
);

/** A Given sets the score; a Then reads it from the arena. */
Step('no rider has a round win', async (w) => {
  if (settingUp(w)) await w.s.apply(arrangeRoundWins, {});
  const shown = Object.values(await w.s.read(roundWinsShown));
  expect(shown.every((wins) => wins === 0)).toBe(true);
});
/** A Given sets the score; a Then reads it from the arena. */
Step(
  '{lightCyclesRider} (still )has {int} round win(s) and {lightCyclesRider} has {int}',
  async (
    w,
    ...[first, wins, second, other]: [
      LightCyclesRiderName,
      number,
      LightCyclesRiderName,
      number,
    ]
  ) => {
    const score = { [first]: wins, [second]: other };
    if (settingUp(w)) await w.s.apply(arrangeRoundWins, score);
    expect(await w.s.read(roundWinsShown)).toMatchObject(score);
  }
);

When('{lightCyclesRider} crashes', (w, rider: LightCyclesRiderName) =>
  w.s.apply(crashRiders, [rider])
);
When(
  '{lightCyclesRider} and {lightCyclesRider} both crash',
  (w, first: LightCyclesRiderName, second: LightCyclesRiderName) =>
    w.s.apply(crashRiders, [first, second], true)
);
Given(
  '{lightCyclesRider} won the {lightCyclesRound} round after {lightCyclesRider} crashed',
  (w, winner: LightCyclesRiderName, round: number) =>
    w.s.apply(winRound, winner, round)
);

Then(
  'everyone sees {lightCyclesRider} won the round',
  async (w, rider: LightCyclesRiderName) => {
    const seen = await w.s.until(bannersShown, {
      maxMs: RESULT_MS,
      pred: (banners) =>
        banners.every((banner) =>
          banner.startsWith(`${rider} wins the round.`)
        ),
    });
    for (const banner of seen)
      expect(banner).toStartWith(`${rider} wins the round.`);
  }
);
Then('everyone sees the round is drawn', async (w) => {
  const seen = await w.s.until(bannersShown, {
    maxMs: RESULT_MS,
    pred: (banners) =>
      banners.every((banner) => banner.startsWith('The round is drawn.')),
  });
  for (const banner of seen) expect(banner).toStartWith('The round is drawn.');
});
Then(
  'the {lightCyclesRound} round is counting down on an arena with no trails',
  async (w, round: number) => {
    const board = await w.s.until((s) => arenaShown(s), {
      maxMs: RESULT_MS,
      pred: (shown) => shown.round === round && shown.phase === 'countdown',
    });
    expect(board.riders.every((rider) => rider.trail.length === 1)).toBe(true);
  }
);
