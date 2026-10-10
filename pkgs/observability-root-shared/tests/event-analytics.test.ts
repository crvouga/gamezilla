import { expect, test } from 'bun:test';
import {
  type AnalyticsEvent,
  activeSubjects,
  logicalEvents,
} from '@pkgs/observability-root-shared/event-analytics';

const window = { fromMs: 1000, untilMs: 2000 };
const event: AnalyticsEvent = {
  name: 'example.game.started',
  version: 1,
  id: 'game-1',
  occurredAtMs: 1000,
  synthetic: false,
  attributes: { 'user.id': 'subject-1', 'game.mode': 'bot' },
};

test('replays and late arrival count one logical event in its event-time window', () => {
  expect(
    logicalEvents(
      [event, { ...event }, { ...event, id: 'game-2', occurredAtMs: 2000 }],
      window
    )
  ).toEqual([event]);
  expect(logicalEvents([{ ...event, synthetic: true }], window)).toEqual([]);
  expect(logicalEvents([{ ...event, occurredAtMs: 999 }], window)).toEqual([]);
});

test('conflicting replays fail even when one copy would be excluded as synthetic', () => {
  expect(() =>
    logicalEvents([event, { ...event, synthetic: true }], window)
  ).toThrow('Conflicting');
  expect(
    logicalEvents(
      [
        event,
        {
          ...event,
          attributes: { 'game.mode': 'bot', 'user.id': 'subject-1' },
        },
      ],
      window
    )
  ).toEqual([event]);
});

test('active subjects require meaningful activity and exclude erased identities', () => {
  const input = {
    window,
    meaningfulEventNames: ['example.game.started'],
    subjectAttributes: ['user.id'],
    erasedSubjectIds: new Set<string>(),
  };
  expect(
    activeSubjects([event, event, { ...event, id: 'game-2' }], input)
  ).toBe(1);
  expect(
    activeSubjects([{ ...event, name: 'example.page.viewed' }], input)
  ).toBe(0);
  expect(
    activeSubjects([event], {
      ...input,
      erasedSubjectIds: new Set(['subject-1']),
    })
  ).toBe(0);
});

test('missing synthetic provenance cannot enter genuine business totals', () => {
  const { synthetic: _synthetic, ...unknown } = event;
  expect(logicalEvents([unknown], window)).toEqual([]);
});
