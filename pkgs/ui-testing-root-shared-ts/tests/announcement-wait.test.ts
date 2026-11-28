import { expect, test } from 'bun:test';
import { waitTextMatches } from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: pong-playability-read-during-reconnection
test('one sample accepts either playable Pong announcement while the connection changes', () => {
  const playing = {
    text: ['Serve in', 'Keep the ball in play.'],
    exact: false,
  } as const;
  expect(waitTextMatches(null, playing)).toBe(false);
  expect(waitTextMatches('Reconnecting…', playing)).toBe(false);
  expect(waitTextMatches('Serve in 3', playing)).toBe(true);
  expect(waitTextMatches('Keep the ball in play.', playing)).toBe(true);
  expect(waitTextMatches('Match finished.', playing)).toBe(false);
});
