import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type {
  LightCyclesDirection,
  LightCyclesRiderName,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  type LightCyclesStage,
  stageShown,
} from '@libs/light-cycles-harness-ts/light-cycles-game-actions';
import {
  establishEveryRiderReady,
  establishLightCyclesGame,
  joinLightCycles,
  type LightCyclesCount,
} from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import {
  arenaShown,
  gamesSeenBy,
  identityShown,
  riderShown,
  seatShown,
  steeringShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import {
  crashRiders,
  endCountdown,
  reachRoundRiding,
} from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { arrangeRoundWins } from '@libs/light-cycles-harness-ts/light-cycles-round-actions';
import { endRoundDrawn } from '@libs/light-cycles-harness-ts/light-cycles-round-over';

/** A countdown lasts 3 seconds: a rider waiting is seen waiting within it. */
const COUNTDOWN_MS = 3000;
/** The time a person's device takes to show the game it has just opened. */
const CAUGHT_UP_MS = 5000;

Given(
  '{actor} has a Light Cycles {lightCyclesMode} custom game with every rider ready',
  (w, _host: string, count: LightCyclesCount) =>
    w.s.apply(establishEveryRiderReady, count)
);
Given(
  'round {int} of a Light Cycles {lightCyclesMode} game has just ended',
  async (w, round: number, count: LightCyclesCount) => {
    await w.s.apply(establishEveryRiderReady, count);
    await w.s.apply(endRoundDrawn, round);
  }
);
Given(
  '{actor} rides {lightCyclesRider} and {actor} rides {lightCyclesRider} in a Light Cycles {lightCyclesMode} watched by {actor} and by {actor}, a guest who is not signed in',
  (
    w,
    ...[first, rider, second, other, count, watcher, guest]: [
      string,
      LightCyclesRiderName,
      string,
      LightCyclesRiderName,
      LightCyclesCount,
      string,
      string,
    ]
  ) =>
    w.s.apply(establishLightCyclesGame, {
      count,
      riders: { [rider]: first, [other]: second },
      watchers: [watcher],
      guests: [guest],
    })
);
Given(
  'the riders are riding in the {lightCyclesRound} round with {lightCyclesRider} on {int} round win',
  async (w, round: number, rider: LightCyclesRiderName, wins: number) => {
    await w.s.apply(arrangeRoundWins, { [rider]: wins }, round - 1);
    await w.s.apply(endCountdown);
    expect(await w.s.read(arenaShown)).toMatchObject({
      round,
      phase: 'running',
    });
  }
);
Given(
  '{lightCyclesRider} crashed in the {lightCyclesRound} round while {lightCyclesRiders} are still riding',
  async (
    w,
    rider: LightCyclesRiderName,
    round: number,
    others: LightCyclesRiderName[]
  ) => {
    await w.s.apply(reachRoundRiding, round);
    await w.s.apply(crashRiders, [rider]);
    for (const other of others)
      expect((await w.s.read(riderShown, other)).riding).toBe(true);
  }
);

When("{actor} joins {actor}'s space", (w, person: string) =>
  w.s.apply(joinLightCycles, person)
);

Then(
  'the {lightCyclesRound} round counts down with {lightCyclesRiders}',
  async (w, round: number, riders: LightCyclesRiderName[]) => {
    const board = await w.s.read(arenaShown);
    expect(board).toMatchObject({ round, phase: 'countdown' });
    expect(board.riders.map((rider) => rider.name)).toEqual(riders);
  }
);
Then(
  '{lightCyclesRider} waits at column {int}, row {int} heading {lightCyclesHeading}',
  async (
    w,
    ...[rider, column, row, heading]: [
      LightCyclesRiderName,
      number,
      number,
      LightCyclesDirection,
    ]
  ) => {
    await w.s.until(arenaShown, {
      maxMs: COUNTDOWN_MS,
      pred: (board) => board.phase === 'countdown',
    });
    expect(await w.s.read(riderShown, rider)).toMatchObject({
      column,
      row,
      heading,
    });
  }
);
Then(
  'the Light Cycles game is still {lightCyclesStage}',
  async (w, stage: LightCyclesStage) => {
    expect(await w.s.read(stageShown)).toBe(stage);
  }
);
Then(
  "{actor} cannot steer {lightCyclesRider} because it is {actor}'s rider",
  async (w, actor: string, rider: LightCyclesRiderName, owner: string) => {
    expect((await w.s.read(steeringShown, actor, rider)).offered).toBe(false);
    expect(await w.s.read(seatShown, actor, rider)).toEqual({
      kind: 'person',
      person: await w.s.read(identityShown, owner),
    });
  }
);
Then(
  '{actor} sees the same arena, trails, riders, score, round and countdown as {actor}',
  async (w, actor: string, other: string) => {
    const [seen, theirs] = await w.s.until(
      (s) => gamesSeenBy(s, actor, other),
      {
        maxMs: CAUGHT_UP_MS,
        pred: ([a, b]) => JSON.stringify(a) === JSON.stringify(b),
      }
    );
    expect(seen).toEqual(theirs);
  }
);
Then(
  '{actor} cannot steer any rider because every rider is taken',
  async (w, actor: string) => {
    const board = await w.s.read(arenaShown, actor);
    expect(board.steering).toBe('watching');
    for (const rider of board.riders) {
      expect((await w.s.read(steeringShown, actor, rider.name)).offered).toBe(
        false
      );
      expect((await w.s.read(seatShown, actor, rider.name))?.kind).toBe(
        'person'
      );
    }
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} because it has crashed in this round',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    expect(await w.s.read(steeringShown, actor, rider)).toEqual({
      offered: false,
      status: 'crashed',
    });
  }
);
Then('{lightCyclesRider} is riding', async (w, rider: LightCyclesRiderName) => {
  expect((await w.s.read(riderShown, rider)).riding).toBe(true);
});
Then(
  '{actor} can steer {lightCyclesRider}',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    const steering = await w.s.until((s) => steeringShown(s, actor, rider), {
      maxMs: CAUGHT_UP_MS,
      pred: (shown) => shown.offered,
    });
    expect(steering.status).toMatch(/^(riding|countdown)$/);
  }
);
