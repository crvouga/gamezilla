import { expect, test } from 'bun:test';
import {
  timeControlText,
  timeControlWords,
} from '@libs/game-matchmaking-client-ts/time-control-name';

// regression: untimed-match-shows-play-as-clock
test('an untimed match choice names no clock', () => {
  for (const id of ['play', 'some-game/play']) {
    expect(timeControlText(id)).toBe('');
    expect(timeControlWords(id)).toBe('');
  }
});

test('a timed match choice still names its clock', () => {
  expect(timeControlText('5+0')).toBe('5+0');
  expect(timeControlWords('5+0')).not.toBe('');
});
