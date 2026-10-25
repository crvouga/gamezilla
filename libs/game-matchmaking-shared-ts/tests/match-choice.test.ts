import { expect, test } from 'bun:test';
import {
  defaultMatchChoice,
  matchChoiceOf,
  offeredMatchChoices,
} from '@libs/game-matchmaking-shared-ts/match-choice';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { countingRules } from './counting-rules';

const notice = {
  side: (side: string) => side,
  ending: () => undefined,
  timeoutDraw: () => 'drawn on time',
};
const timed = { namespace: 'timed/', clockChoices: true as const, notice };
const clockless = { namespace: 'clockless/', notice };
const rules = createTurnGames([
  {
    rules: countingRules('timed'),
    capabilities: { matchmaking: timed, history: { record: () => '' } },
  },
  {
    rules: countingRules('clockless'),
    capabilities: { matchmaking: clockless, history: { record: () => '' } },
  },
]);

test('clockless matchmaking advertises one choice and one distinct rating pool', () => {
  const choices = offeredMatchChoices(rules).filter((choice) =>
    choice.id.startsWith('clockless/')
  );
  expect(choices).toEqual([
    { id: 'clockless/play', ratingPool: 'clockless:game', clock: null },
  ]);
  expect(defaultMatchChoice(clockless)).toBe('clockless/play');
  expect(matchChoiceOf('clockless/play')).toEqual(choices[0]!);
});

test('timed choices retain their clocks and separate speed ratings', () => {
  expect(defaultMatchChoice(timed)).toBe('timed/5+0');
  expect(matchChoiceOf('timed/5+0')).toEqual({
    id: 'timed/5+0',
    ratingPool: 'timed:blitz',
    clock: {
      id: 'timed/5+0',
      speed: 'timed:blitz',
      minutes: 5,
      incrementSeconds: 0,
      daysPerMove: 0,
    },
  });
  expect(
    offeredMatchChoices(rules).filter((choice) => choice.clock !== null)
  ).toHaveLength(14);
  expect(matchChoiceOf('clockless/anything')).toBeNull();
  expect(matchChoiceOf(null)).toBeNull();
});
