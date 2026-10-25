import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { recall, remember } from '@libs/harness-ts/spec-world';
import {
  comeBack,
  goAway,
  ownRiderSteering,
  stayAwayInRound,
  watchWithConnection,
} from '@libs/light-cycles-harness-ts/light-cycles-away';
import type {
  LightCyclesDirection,
  LightCyclesRiderName,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  gameStatusText,
  stageShown,
} from '@libs/light-cycles-harness-ts/light-cycles-game-actions';
import {
  arenaShown,
  riderShown,
  roundWinsShown,
  steeringShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import {
  placeLightCyclesArena,
  reachRoundEnd,
} from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { startingCellOf } from '@libs/light-cycles-harness-ts/light-cycles-starting-cells';

const SECOND_MS = 1000;
/** Long enough for a device to notice it has lost its connection. */
const NOTICED_MS = 2000;
/** One step and a little more: a rider riding on is seen moving within it. */
const STEP_SEEN_MS = 200;
const ROUND_WINS = 'round wins before the connection came back';

Given('{actor} is away', (w, person: string) => w.s.apply(goAway, person));
Given(
  '{actor}, {actor} and {actor} are all away',
  async (w, ...people: [string, string, string]) => {
    for (const person of people) await w.s.apply(goAway, person);
  }
);
Given(
  '{actor} has been away for {int} seconds',
  async (w, person: string, seconds: number) => {
    await w.s.apply(goAway, person);
    await w.s.advanceTime(seconds * SECOND_MS);
  }
);
Given(
  '{lightCyclesRider} has crashed in this round',
  (w, rider: LightCyclesRiderName) =>
    w.s.apply(placeLightCyclesArena, { crashedAside: [rider] })
);
Given(
  '{actor} has stayed away since {lightCyclesRider} crashed in the {lightCyclesRound} round',
  async (w, person: string, _rider: LightCyclesRiderName, round: number) => {
    await w.s.apply(stayAwayInRound, [person], round);
    remember(w, ROUND_WINS, await w.s.read(roundWinsShown));
  }
);
Given(
  '{actor} and {actor} have stayed away since the {lightCyclesRound} round',
  (w, first: string, second: string, round: number) =>
    w.s.apply(stayAwayInRound, [first, second], round)
);
Given(
  '{actor} came back after being away in the {lightCyclesRound} round, before the {lightCyclesRound} round began',
  async (w, person: string, round: number, next: number) => {
    await w.s.apply(stayAwayInRound, [person], round);
    await w.s.apply(comeBack, person);
    expect((await w.s.read(arenaShown)).round).toBeLessThan(next);
  }
);
Given('the {lightCyclesRound} round has just ended', (w, round: number) =>
  w.s.apply(reachRoundEnd, round)
);
Given("{actor}'s connection has come back", (w, person: string) =>
  w.s.apply(comeBack, person)
);
When("{actor}'s connection comes back", (w, person: string) =>
  w.s.apply(comeBack, person)
);

Then(
  '{actor} and {actor} see {lightCyclesRider} go on heading {lightCyclesHeading}',
  async (
    w,
    ...[first, second, rider, heading]: [
      string,
      string,
      LightCyclesRiderName,
      LightCyclesDirection,
    ]
  ) => {
    for (const actor of [first, second]) {
      const before = await w.s.read(riderShown, rider, actor);
      const after = await w.s.until((s) => riderShown(s, rider, actor), {
        maxMs: STEP_SEEN_MS,
        pred: (seen) =>
          seen.column !== before.column || seen.row !== before.row,
      });
      expect(after).toMatchObject({ riding: true, heading });
    }
  }
);
Then(
  '{actor} and {actor} can steer their own riders',
  async (w, ...people: [string, string]) => {
    for (const person of people)
      expect(await w.s.read(ownRiderSteering, person)).toEqual({
        offered: true,
        status: 'riding',
      });
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} while she is away',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    const steering = await w.s.until((s) => steeringShown(s, actor, rider), {
      maxMs: NOTICED_MS,
      pred: (shown) => shown.status === 'away',
    });
    expect(steering).toEqual({ offered: false, status: 'away' });
  }
);
Then(
  '{lightCyclesRider} has crashed',
  async (w, rider: LightCyclesRiderName) => {
    const shown = await w.s.until((s) => riderShown(s, rider), {
      maxMs: STEP_SEEN_MS,
      pred: (seen) => !seen.riding,
    });
    expect(shown.riding).toBe(false);
  }
);
Then(
  '{lightCyclesRider} sits out the {lightCyclesRound} round on its starting cell',
  async (w, rider: LightCyclesRiderName, round: number) => {
    const board = await w.s.read(arenaShown);
    expect(board).toMatchObject({ round, phase: 'countdown' });
    const start = startingCellOf(board.riders.length, rider, round);
    expect(await w.s.read(riderShown, rider)).toMatchObject({
      riding: false,
      column: start.column,
      row: start.row,
    });
  }
);
Then(
  '{lightCyclesRider} is still crashed in the {lightCyclesRound} round with its trail on the arena',
  async (w, rider: LightCyclesRiderName, round: number) => {
    expect((await w.s.read(arenaShown)).round).toBe(round);
    const shown = await w.s.read(riderShown, rider);
    expect(shown.riding).toBe(false);
    expect(shown.trail).toContain(
      `${String(shown.column)},${String(shown.row)}`
    );
  }
);
Then("every rider's round wins are unchanged", async (w) => {
  const before = recall(w, ROUND_WINS) as Record<string, number>;
  expect(await w.s.read(roundWinsShown)).toEqual(before);
});
Given(
  "{actor} is watching the Light Cycles game in {actor}'s space with a connection",
  (w, watcher: string) => w.s.apply(watchWithConnection, watcher)
);
Then(
  '{actor} sees the Light Cycles game is called off with no winner',
  async (w, actor: string) => {
    const stage = await w.s.until((s) => stageShown(s, actor), {
      maxMs: STEP_SEEN_MS,
      pred: (shown) => shown === 'called off',
    });
    expect(stage).toBe('called off');
    expect(await w.s.read(gameStatusText, actor)).toContain('Game cancelled.');
  }
);
Then(
  '{actor} sees the Light Cycles game is still unfinished',
  async (w, actor: string) => {
    expect(await w.s.read(stageShown, actor)).toBe('under way');
  }
);
Then(
  '{actor} sees {lightCyclesRider} has {int} round win(s) and {lightCyclesRider} has {int}',
  async (
    w,
    ...[actor, first, wins, second, other]: [
      string,
      LightCyclesRiderName,
      number,
      LightCyclesRiderName,
      number,
    ]
  ) => {
    expect(await w.s.read(roundWinsShown, actor)).toMatchObject({
      [first]: wins,
      [second]: other,
    });
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} because the Light Cycles game is called off',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    expect((await w.s.read(steeringShown, actor, rider)).offered).toBe(false);
    expect(await w.s.read(stageShown, actor)).toBe('called off');
  }
);
