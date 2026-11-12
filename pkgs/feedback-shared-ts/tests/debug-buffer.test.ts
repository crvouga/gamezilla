import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  createDebugBuffer,
  DEBUG_WINDOW_MS,
  MAX_BUFFERED_EVENTS,
  MAX_EVENT_TEXT,
} from '@pkgs/feedback-shared-ts/debug-buffer';

const START = Date.parse('2026-03-02T10:00:00.000Z');

function buffer() {
  const { clock } = createHarnessClock({ startMs: START });
  return { clock, debug: createDebugBuffer({ clock }) };
}

test('an event stays for five minutes and no longer', () => {
  const { clock, debug } = buffer();
  debug.record('navigation', 'Went to /settings');
  clock.advance(DEBUG_WINDOW_MS);
  expect(debug.snapshot().map((event) => event.text)).toEqual([
    'Went to /settings',
  ]);
  clock.advance(1);
  expect(debug.snapshot()).toEqual([]);
});

test('events come back oldest first with the time they happened', () => {
  const { clock, debug } = buffer();
  debug.record('choice', 'Chose "Play"');
  clock.advance(1500);
  debug.record('trouble', 'Error: board froze');
  expect(debug.snapshot()).toEqual([
    { at: '2026-03-02T10:00:00.000Z', kind: 'choice', text: 'Chose "Play"' },
    {
      at: '2026-03-02T10:00:01.500Z',
      kind: 'trouble',
      text: 'Error: board froze',
    },
  ]);
});

test('a busy app keeps only the newest events', () => {
  const { debug } = buffer();
  for (let index = 0; index < MAX_BUFFERED_EVENTS + 25; index++)
    debug.record('choice', `Chose ${index}`);
  const events = debug.snapshot();
  expect(events).toHaveLength(MAX_BUFFERED_EVENTS);
  expect(events[0]?.text).toBe('Chose 25');
  expect(events.at(-1)?.text).toBe(`Chose ${MAX_BUFFERED_EVENTS + 24}`);
});

test('a long event is cut short, and trouble keeps its stack', () => {
  const { debug } = buffer();
  debug.record('choice', 'c'.repeat(MAX_EVENT_TEXT + 50));
  debug.record('trouble', 't'.repeat(MAX_EVENT_TEXT + 50));
  const [choice, trouble] = debug.snapshot();
  expect(choice?.text).toHaveLength(MAX_EVENT_TEXT);
  expect(trouble?.text).toHaveLength(MAX_EVENT_TEXT + 50);
});

test('events of the last visit come back in order, without the stale or unreadable', () => {
  const { clock, debug } = buffer();
  debug.record('navigation', 'Opened the app at /');
  debug.restore([
    {
      at: new Date(START - DEBUG_WINDOW_MS - 1).toISOString(),
      kind: 'choice',
      text: 'Too old',
    },
    {
      at: new Date(START - 1000).toISOString(),
      kind: 'trouble',
      text: 'Error: crashed',
    },
    { at: 'not a time', kind: 'choice', text: 'Unreadable' },
  ]);
  clock.advance(10);
  expect(debug.snapshot().map((event) => event.text)).toEqual([
    'Error: crashed',
    'Opened the app at /',
  ]);
});
