import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { LightCyclesRiderName } from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  chooseTargetScore,
  refusalTold,
  targetScoreRefusalShown,
} from '@libs/light-cycles-harness-ts/light-cycles-choices';
import {
  gameStatusText,
  type LightCyclesStage,
  reachLightCyclesStage,
  stageShown,
  winLightCycles,
} from '@libs/light-cycles-harness-ts/light-cycles-game-actions';
import {
  establishLightCyclesGame,
  everyoneSeeing,
  type LightCyclesCount,
  shownNameOf,
  startLightCyclesGame,
} from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import {
  arenaShown,
  bannersShown,
  steeringShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import { arrangeRoundWins } from '@libs/light-cycles-harness-ts/light-cycles-round-actions';

/** The reasons a choice is refused once the custom game has started. */
const AFTER_THE_START = ['already started', 'finished', 'cancelled'];
const RESULT_MS = 2000;

Given(
  '{actor} rides {lightCyclesRider} and {actor} rides {lightCyclesRider} in a Light Cycles {lightCyclesMode} with a target score of {int}',
  (
    w,
    ...[first, rider, second, other, count, target]: [
      string,
      LightCyclesRiderName,
      string,
      LightCyclesRiderName,
      LightCyclesCount,
      number,
    ]
  ) =>
    w.s.apply(establishLightCyclesGame, {
      count,
      riders: { [rider]: first, [other]: second },
      target,
    })
);
Given(
  '{actor} has created a Light Cycles {lightCyclesMode} custom game with {actor} riding {lightCyclesRider}',
  (
    w,
    ...[host, count, other, rider]: [
      string,
      LightCyclesCount,
      string,
      LightCyclesRiderName,
    ]
  ) =>
    w.s.apply(establishLightCyclesGame, {
      count,
      host,
      riders: { Comet: host, [rider]: other },
    })
);
Given(
  '{lightCyclesRider} has {int} round wins and {lightCyclesRider} has {int} after {int} rounds',
  async (
    w,
    ...[first, wins, second, other, rounds]: [
      LightCyclesRiderName,
      number,
      LightCyclesRiderName,
      number,
      number,
    ]
  ) => {
    await w.s.apply(
      arrangeRoundWins,
      { [first]: wins, [second]: other },
      rounds
    );
    expect((await w.s.read(arenaShown)).round).toBe(rounds + 1);
  }
);
Given(
  '{lightCyclesRider} has won the Light Cycles game by {int} to {int}',
  async (w, winner: LightCyclesRiderName, wins: number, other: number) => {
    await w.s.apply(winLightCycles, winner, other);
    const board = await w.s.read(arenaShown);
    expect(board.phase).toBe('completed');
    expect(board.riders.map((rider) => rider.score)).toEqual([wins, other]);
  }
);
Given(
  'the Light Cycles game is {lightCyclesStage}',
  async (w, stage: LightCyclesStage) => {
    await w.s.apply(reachLightCyclesStage, stage);
    expect(await w.s.read(stageShown)).toBe(stage);
  }
);

When('{actor} starts the custom game', (w) => w.s.apply(startLightCyclesGame));
When(
  '{actor} chooses a target score of {int}',
  (w, actor: string, target: number) =>
    w.s.apply(chooseTargetScore, actor, target)
);

Then(
  'everyone sees {lightCyclesRider}, ridden by {actor}, won the Light Cycles game',
  async (w, rider: LightCyclesRiderName, person: string) => {
    for (const actor of await w.s.read(everyoneSeeing)) {
      const status = await w.s.until((s) => gameStatusText(s, actor), {
        maxMs: RESULT_MS,
        pred: (text) => text.includes(`${rider} wins by`),
      });
      expect(status).toContain(
        `${rider}: ${await w.s.read(shownNameOf, person)}.`
      );
    }
  }
);
Then('everyone sees the Light Cycles game was drawn', async (w) => {
  for (const actor of await w.s.read(everyoneSeeing))
    expect(
      await w.s.until((s) => gameStatusText(s, actor), {
        maxMs: RESULT_MS,
        pred: (text) => text.includes('Game drawn.'),
      })
    ).toContain('Game drawn.');
  for (const banner of await w.s.read(bannersShown))
    expect(banner).toBe('The game is drawn.');
});
Then(
  'the final score is (still ){int} to {int}',
  async (w, first: number, second: number) => {
    const board = await w.s.read(arenaShown);
    expect(board.phase).toBe('completed');
    expect(board.riders.map((rider) => rider.score)).toEqual([first, second]);
  }
);
Then('the Light Cycles game is still unfinished', async (w) => {
  expect((await w.s.read(arenaShown)).phase).not.toBe('completed');
  expect(await w.s.read(stageShown)).toBe('under way');
});
Then(
  'the Light Cycles game (still )has a target score of {int}',
  async (w, target: number) => {
    expect((await w.s.read(arenaShown)).targetScore).toBe(target);
  }
);
Then(
  '{actor} is told the target score must be from 1 to 9',
  async (w, actor: string) => {
    expect(await w.s.read(targetScoreRefusalShown, actor)).toBe(true);
  }
);
Then(
  '{actor} is told only the creator chooses the target score',
  async (w, actor: string) => {
    expect(await w.s.read(refusalTold, actor)).toBe('only the creator');
  }
);
Then(
  '{actor} is told the target score cannot change once the game has started',
  async (w, actor: string) => {
    expect(AFTER_THE_START).toContain(await w.s.read(refusalTold, actor));
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} because the Light Cycles game is finished',
  async (w, actor: string, rider: LightCyclesRiderName) => {
    expect(await w.s.read(steeringShown, actor, rider)).toEqual({
      offered: false,
      status: 'finished',
    });
  }
);
