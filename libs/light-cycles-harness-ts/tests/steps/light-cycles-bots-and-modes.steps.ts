import { expect } from 'bun:test';
import { offeredGameChoices } from '@libs/game-session-harness-ts/game-navigation';
import { Given, Then, When } from '@libs/harness-ts/define';
import type {
  LightCyclesCell,
  LightCyclesDirection,
  LightCyclesRiderName,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  chooseBot,
  refusalTold,
} from '@libs/light-cycles-harness-ts/light-cycles-choices';
import {
  gameStatusText,
  type LightCyclesStage,
  reachLightCyclesStage,
  stageShown,
} from '@libs/light-cycles-harness-ts/light-cycles-game-actions';
import {
  establishLightCyclesGame,
  everyoneSeeing,
  type LightCyclesBotLevel,
  type LightCyclesCount,
  shownNameOf,
  startLightCyclesGame,
} from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import {
  establishPractice,
  findPlayers,
  joinSpaceOf,
  pairPeopleUp,
  pickLightCyclesMode,
  riderFoundFor,
  startPractice,
  stillFindingPlayers,
  takeLightCyclesSeat,
} from '@libs/light-cycles-harness-ts/light-cycles-modes';
import {
  arenaShown,
  botShown,
  riderShown,
  seatShown,
  steeringShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import {
  boxInBotRiders,
  placeLightCyclesArena,
  takeNextStep,
} from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { arrangeRoundWins } from '@libs/light-cycles-harness-ts/light-cycles-round-actions';

/** A countdown (3 s) and one step (100 ms): the next step comes within it. */
const NEXT_STEP_MS = 3200;
const RESULT_MS = 2000;
const SHOWN_MS = 5000;

Given(
  '{actor} has created a Light Cycles {lightCyclesMode} custom game',
  (w, host: string, count: LightCyclesCount) =>
    w.s.apply(establishLightCyclesGame, {
      count,
      host,
      riders: { Comet: host },
    })
);
Given(
  "{actor} rides {lightCyclesRider} in {actor}'s custom game",
  (w, person: string, rider: LightCyclesRiderName) =>
    w.s.apply(takeLightCyclesSeat, person, rider)
);
Given(
  '{actor} has started the custom game with {actor} riding {lightCyclesRider} and a {lightCyclesBotLevel} bot riding {lightCyclesRider}',
  async (
    w,
    ...[host, , , level, rider]: [
      string,
      string,
      LightCyclesRiderName,
      LightCyclesBotLevel,
      LightCyclesRiderName,
    ]
  ) => {
    await w.s.apply(chooseBot, host, rider, level);
    await w.s.apply(startLightCyclesGame);
    expect(await w.s.read(stageShown)).toBe('under way');
  }
);
When(
  '{actor} chooses a {lightCyclesBotLevel} bot to ride {lightCyclesRider}',
  (w, actor: string, level: LightCyclesBotLevel, rider: LightCyclesRiderName) =>
    w.s.apply(chooseBot, actor, rider, level)
);
Then(
  'everyone in the space sees {lightCyclesRider} shown as a {lightCyclesBotLevel} bot',
  async (w, rider: LightCyclesRiderName, level: LightCyclesBotLevel) => {
    for (const actor of await w.s.read(everyoneSeeing))
      expect(await w.s.read(botShown, actor, rider)).toEqual({
        bot: true,
        level,
      });
  }
);
Then(
  '{actor} is told the bots cannot change once the game has started',
  async (w, actor: string) => {
    expect(['already started', 'finished', 'cancelled']).toContain(
      await w.s.read(refusalTold, actor)
    );
  }
);
Then(
  '{actor} is told only the creator chooses the bots',
  async (w, actor: string) => {
    expect(await w.s.read(refusalTold, actor)).toBe('only the creator');
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} because a bot rides it',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    expect((await w.s.read(steeringShown, actor, rider)).offered).toBe(false);
    expect((await w.s.read(seatShown, actor, rider))?.kind).toBe('bot');
  }
);

Given(
  "{actor}'s Light Cycles {lightCyclesMode} practice has a {lightCyclesBotLevel} bot riding {lightCyclesRider} at column {int}, row {int} heading {lightCyclesHeading}",
  async (
    w,
    ...[actor, count, level, rider, column, row, heading]: [
      string,
      LightCyclesCount,
      LightCyclesBotLevel,
      LightCyclesRiderName,
      number,
      number,
      LightCyclesDirection,
    ]
  ) => {
    await w.s.apply(establishPractice, { actor, count, level });
    await w.s.apply(placeLightCyclesArena, {
      placed: { [rider]: { column, row, heading, riding: true } },
    });
  }
);
Given('trails cover {lightCyclesCells}', (w, cells: LightCyclesCell[]) =>
  w.s.apply(placeLightCyclesArena, { anyTrails: cells })
);
When('the bot steers {lightCyclesRider}', (w) => w.s.apply(takeNextStep));
Then(
  "{lightCyclesRider}'s next step is {lightCyclesHeadings}",
  async (w, rider: LightCyclesRiderName, headings: LightCyclesDirection[]) => {
    const before = await w.s.read(riderShown, rider);
    const after = await w.s.until((s) => riderShown(s, rider), {
      maxMs: NEXT_STEP_MS,
      pred: (seen) => seen.column !== before.column || seen.row !== before.row,
    });
    expect(headings).toContain(after.heading);
  }
);

When(
  '{actor} starts Light Cycles {lightCyclesMode} practice against a {lightCyclesBotLevel} bot',
  (w, actor: string, count: LightCyclesCount, level: LightCyclesBotLevel) =>
    w.s.apply(startPractice, actor, count, level)
);
Then(
  'the {lightCyclesRound} round counts down with {actor} riding {lightCyclesRider} and the bot riding {lightCyclesRider}',
  async (
    w,
    ...[round, actor, rider, botRider]: [
      number,
      string,
      LightCyclesRiderName,
      LightCyclesRiderName,
    ]
  ) => {
    const board = await w.s.read(arenaShown, actor);
    expect(board).toMatchObject({ round, phase: 'countdown' });
    expect(
      board.riders
        .filter((shown) => shown.steeredHere)
        .map((shown) => shown.name)
    ).toEqual([rider]);
    expect((await w.s.read(seatShown, actor, botRider))?.kind).toBe('bot');
  }
);
Given(
  "{actor}'s Light Cycles {lightCyclesMode} practice is riding with {lightCyclesRider} at column {int}, row {int} heading {lightCyclesHeading}",
  async (
    w,
    ...[actor, count, rider, column, row, heading]: [
      string,
      LightCyclesCount,
      LightCyclesRiderName,
      number,
      number,
      LightCyclesDirection,
    ]
  ) => {
    await w.s.apply(establishPractice, {
      actor,
      count,
      level: 'medium',
    });
    await w.s.apply(placeLightCyclesArena, {
      placed: { [rider]: { column, row, heading, riding: true } },
    });
  }
);
Given(
  "{actor}'s Light Cycles {lightCyclesMode} practice has {lightCyclesRider} on {int} round wins against a {lightCyclesBotLevel} bot with a target score of {int}",
  async (
    w,
    ...[actor, count, rider, wins, level, target]: [
      string,
      LightCyclesCount,
      LightCyclesRiderName,
      number,
      LightCyclesBotLevel,
      number,
    ]
  ) => {
    await w.s.apply(establishPractice, { actor, count, level, target });
    await w.s.apply(arrangeRoundWins, { [rider]: wins });
    // The bot's rider is about to crash, whatever the bot steers.
    await w.s.apply(boxInBotRiders);
  }
);
Then(
  '{actor} sees {lightCyclesRider}, ridden by {actor}, won the Light Cycles game',
  async (w, actor: string, rider: LightCyclesRiderName, person: string) => {
    const status = await w.s.until((s) => gameStatusText(s, actor), {
      maxMs: RESULT_MS,
      pred: (text) => text.includes(`${rider} wins by`),
    });
    expect(status).toContain(
      `${rider}: ${await w.s.read(shownNameOf, person)}.`
    );
  }
);
Given(
  "{actor}'s Light Cycles {lightCyclesMode} practice is {lightCyclesStage}",
  async (
    w,
    actor: string,
    count: LightCyclesCount,
    stage: LightCyclesStage
  ) => {
    await w.s.apply(establishPractice, {
      actor,
      count,
      level: 'medium',
    });
    await w.s.apply(reachLightCyclesStage, stage);
    expect(await w.s.read(stageShown)).toBe(stage);
  }
);
Then(
  "{actor}'s Light Cycles {lightCyclesMode} practice is still {lightCyclesStage}",
  async (w, actor: string, _count: number, stage: LightCyclesStage) => {
    expect(await w.s.read(stageShown, actor)).toBe(stage);
  }
);

Given("{actor} has joined {actor}'s space", (w, person: string, host: string) =>
  w.s.apply(joinSpaceOf, person, host)
);
When(
  "{actor} picks Light Cycles {lightCyclesMode} as the space's game",
  (w, host: string, count: LightCyclesCount) =>
    w.s.apply(pickLightCyclesMode, host, count)
);
Then(
  "{actor} and {actor} are offered Light Cycles {lightCyclesMode}'s custom games and finding players",
  async (w, first: string, second: string) => {
    for (const actor of [first, second]) {
      const offered = await w.s.until((s) => offeredGameChoices(s, actor), {
        maxMs: SHOWN_MS,
        pred: (choices) =>
          choices.includes('custom-game') && choices.includes('multiplayer'),
      });
      expect(offered).toEqual(
        expect.arrayContaining(['custom-game', 'multiplayer'])
      );
    }
  }
);
Given(
  '{actor}, {actor} and {actor} are finding players for Light Cycles {lightCyclesMode}',
  (w, ...[a, b, c, count]: [string, string, string, LightCyclesCount]) =>
    w.s.apply(findPlayers, [a, b, c], count)
);
Given(
  '{actor} and {actor} are finding players for Light Cycles {lightCyclesMode}',
  (w, ...[a, b, count]: [string, string, LightCyclesCount]) =>
    w.s.apply(findPlayers, [a, b], count)
);
Given(
  '{actor} is finding players for Light Cycles {lightCyclesMode}',
  (w, actor: string, count: LightCyclesCount) =>
    w.s.apply(findPlayers, [actor], count)
);
When('people are paired up', (w) => w.s.apply(pairPeopleUp));
Then(
  '{actor}, {actor} and {actor} each ride a different one of {lightCyclesRiders}',
  async (
    w,
    ...[a, b, c, riders]: [string, string, string, LightCyclesRiderName[]]
  ) => {
    const ridden = [];
    for (const person of [a, b, c])
      ridden.push(await w.s.read(riderFoundFor, person));
    expect(new Set(ridden)).toEqual(new Set(riders));
  }
);
Then(
  '{actor}, {actor} and {actor} are still finding players',
  async (w, ...people: [string, string, string]) => {
    for (const person of people)
      expect(await w.s.read(stillFindingPlayers, person)).toBe(true);
  }
);
