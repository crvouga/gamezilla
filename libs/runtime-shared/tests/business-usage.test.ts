import { expect, test } from 'bun:test';
import {
  businessUsage,
  gameCompletion,
} from '@libs/runtime-shared/business-usage';
import type { AnalyticsEvent } from '@pkgs/observability-root-shared/event-analytics';

const day = 86_400_000;
const start: AnalyticsEvent = {
  id: 'start-1',
  name: 'chess.game.started',
  version: 1,
  occurredAtMs: 10 * day,
  synthetic: false,
  attributes: {
    'game.id': 'game-1',
    'participant.white.id': 'person-1',
    'participant.black.id': 'person-2',
  },
};

test('versioned active-use windows include both players, exclude synthetic use and respect erasure', () => {
  const earlier = {
    ...start,
    id: 'start-2',
    occurredAtMs: 8 * day,
    attributes: {
      'game.id': 'game-2',
      'participant.white.id': 'person-3',
      'participant.black.id': 'person-4',
    },
  };
  const result = businessUsage(
    [start, start, earlier, { ...start, id: 'synthetic', synthetic: true }],
    {
      reportingDayMs: 10 * day + 123,
      erasedSubjectIds: new Set(['person-2']),
    }
  );
  expect(result).toEqual({ definitionVersion: 1, dau: 1, wau: 3, mau: 3 });
});

test('completion rate uses the started cohort and excludes unrelated games and physical duplicates', () => {
  const completed = {
    ...start,
    id: 'completed-1',
    name: 'chess.game.completed',
    occurredAtMs: 10 * day + 1000,
  };
  expect(
    gameCompletion(
      [
        start,
        completed,
        completed,
        { ...completed, id: 'other', attributes: { 'game.id': 'old-game' } },
      ],
      {
        fromMs: 10 * day,
        untilMs: 11 * day,
      }
    )
  ).toEqual({ started: 1, completed: 1, rate: 1 });
  expect(
    gameCompletion([], { fromMs: 10 * day, untilMs: 11 * day }).rate
  ).toBeNull();
});
