import { expect } from 'bun:test';
import { Given, Step, Then, When } from '@libs/harness-ts/define';
import { settingUp } from '@libs/harness-ts/spec-world';
import type {
  LightCyclesDirection,
  LightCyclesRiderName,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  establishLightCyclesGame,
  type LightCyclesCount,
  lightCyclesStarted,
} from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import {
  steerLightCyclesRider,
  steerQuickly,
} from '@libs/light-cycles-harness-ts/light-cycles-person-steering';
import {
  customGameStatusShown,
  riderShown,
  steeringShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import {
  endCountdown,
  placeLightCyclesArena,
  reachRoundCountdown,
  steerAsRoundEnds,
  takeNextStep,
  winRound,
} from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';

const SECOND_MS = 1000;
/** What the board shows at this step: well inside one 100 ms step. */
const THIS_STEP_MS = 50;
/** A countdown (3 s) and one step (100 ms): the next step comes within it. */
const NEXT_STEP_MS = 3200;

Given(
  '{actor} rides {lightCyclesRider} and {actor} rides {lightCyclesRider} in a Light Cycles {lightCyclesMode}',
  (
    w,
    ...[first, rider, second, other, count]: [
      string,
      LightCyclesRiderName,
      string,
      LightCyclesRiderName,
      LightCyclesCount,
    ]
  ) =>
    w.s.apply(establishLightCyclesGame, {
      count,
      riders: { [rider]: first, [other]: second },
    })
);

Given(
  '{actor} rides {lightCyclesRider}, {actor} rides {lightCyclesRider} and {actor} rides {lightCyclesRider} in a Light Cycles {lightCyclesMode}( on their own devices)',
  (
    w,
    ...[first, a, second, b, third, c, count]: [
      string,
      LightCyclesRiderName,
      string,
      LightCyclesRiderName,
      string,
      LightCyclesRiderName,
      LightCyclesCount,
    ]
  ) =>
    w.s.apply(establishLightCyclesGame, {
      count,
      riders: { [a]: first, [b]: second, [c]: third },
    })
);
/** A Given places the rider; a Then reads where the arena shows it. */
Step(
  '{lightCyclesRider} is at column {int}, row {int} heading {lightCyclesHeading}',
  async (
    w,
    ...[rider, column, row, heading]: [
      LightCyclesRiderName,
      number,
      number,
      LightCyclesDirection,
    ]
  ) => {
    if (settingUp(w)) {
      await w.s.apply(placeLightCyclesArena, {
        placed: { [rider]: { column, row, heading, riding: true } },
      });
      return;
    }
    const shown = await w.s.until((s) => riderShown(s, rider), {
      maxMs: THIS_STEP_MS,
      pred: (seen) => seen.column === column && seen.row === row,
    });
    expect(shown).toMatchObject({ column, row, heading, riding: true });
  }
);

When('the riders take their next step', (w) => w.s.apply(takeNextStep));
When('{int} seconds pass', (w, seconds: number) =>
  w.s.advanceTime(seconds * SECOND_MS)
);
When('the Light Cycles countdown ends', (w) => w.s.apply(endCountdown));

When(
  '{actor} steers {lightCyclesRider} {lightCyclesHeading}',
  (
    w,
    device: string,
    rider: LightCyclesRiderName,
    heading: LightCyclesDirection
  ) => w.s.apply(steerLightCyclesRider, { rider, heading, device })
);
When(
  "{actor} steers {lightCyclesRider} {lightCyclesHeading} with the keyboard's {lightCyclesHeading} arrow",
  (
    w,
    ...[device, rider, heading, arrow]: [
      string,
      LightCyclesRiderName,
      LightCyclesDirection,
      string,
    ]
  ) =>
    w.s.apply(steerLightCyclesRider, {
      rider,
      heading,
      device,
      way: { arrow },
    })
);
When(
  "{actor} steers {lightCyclesRider} {lightCyclesHeading} with the keyboard's {lightCyclesLetter}",
  (
    w,
    ...[device, rider, heading, letter]: [
      string,
      LightCyclesRiderName,
      LightCyclesDirection,
      string,
    ]
  ) =>
    w.s.apply(steerLightCyclesRider, {
      rider,
      heading,
      device,
      way: { letter },
    })
);
When(
  '{actor} steers {lightCyclesRider} {lightCyclesHeading} with the direction pad on her phone',
  (
    w,
    device: string,
    rider: LightCyclesRiderName,
    heading: LightCyclesDirection
  ) => w.s.apply(steerLightCyclesRider, { rider, heading, device, way: 'pad' })
);

Given(
  '{actor} has quickly steered {lightCyclesRider} {lightCyclesHeading} and then {lightCyclesHeading}',
  async (
    w,
    ...[, rider, first, then]: [
      string,
      LightCyclesRiderName,
      LightCyclesDirection,
      LightCyclesDirection,
    ]
  ) => {
    await w.s.apply(steerQuickly, rider, [first, then]);
  }
);
Given(
  '{actor} has quickly steered {lightCyclesRider} {lightCyclesHeading}',
  async (
    w,
    _actor: string,
    rider: LightCyclesRiderName,
    heading: LightCyclesDirection
  ) => {
    await w.s.apply(steerQuickly, rider, [heading]);
  }
);

/** The direction the rider takes on its next step, whenever that step comes. */
Then(
  "{lightCyclesRider}'s next step is (still ){lightCyclesHeading}",
  async (w, rider: LightCyclesRiderName, heading: LightCyclesDirection) => {
    const before = await w.s.read(riderShown, rider);
    const after = await w.s.until((s) => riderShown(s, rider), {
      maxMs: NEXT_STEP_MS,
      pred: (seen) => seen.column !== before.column || seen.row !== before.row,
    });
    expect(after.heading).toBe(heading);
  }
);

Given('the {lightCyclesRound} round is counting down', (w, round: number) =>
  w.s.apply(reachRoundCountdown, round)
);
Given(
  'the {lightCyclesRound} round is counting down with {lightCyclesRider} on its starting cell at column {int}, row {int} heading {lightCyclesHeading}',
  async (
    w,
    ...[round, rider, column, row, heading]: [
      number,
      LightCyclesRiderName,
      number,
      number,
      string,
    ]
  ) => {
    await w.s.apply(reachRoundCountdown, round);
    expect(await w.s.read(riderShown, rider)).toMatchObject({
      column,
      row,
      heading,
    });
  }
);
Given(
  '{lightCyclesRider} won the {lightCyclesRound} round and its round result is showing',
  (w, rider: LightCyclesRiderName, round: number) =>
    w.s.apply(winRound, rider, round)
);
Given(
  '{actor} had steered {lightCyclesRider} {lightCyclesHeading} when the {lightCyclesRound} round ended',
  (
    w,
    ...[, rider, heading, round]: [
      string,
      LightCyclesRiderName,
      LightCyclesDirection,
      number,
    ]
  ) => w.s.apply(steerAsRoundEnds, { rider, heading }, round)
);

Given('the custom game has not started', async (w) => {
  expect(await w.s.read(lightCyclesStarted)).toBe(false);
});

Then(
  '{actor} cannot steer {lightCyclesRider} because the round result is showing',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    expect(await w.s.read(steeringShown, actor, rider)).toEqual({
      offered: false,
      status: 'round-over',
    });
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} because the custom game has not started',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    expect((await w.s.read(steeringShown, actor, rider)).offered).toBe(false);
    expect(await w.s.read(customGameStatusShown, actor)).toBe('configuring');
  }
);
