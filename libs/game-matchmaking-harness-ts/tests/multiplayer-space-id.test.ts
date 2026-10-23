import { expect, test } from 'bun:test';
import { spaceIdForActor } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';

// regression: signed-out-multiplayer-space
test('a signed-out device keeps the space it is standing in', () => {
  expect(spaceIdForActor(null, [], '/space/friday')).toBe('friday');
  expect(spaceIdForActor(null, [], '/tabs')).toBeNull();
  expect(spaceIdForActor('alice', ['a', 'b'], '/space/b')).toBe('b');
  expect(spaceIdForActor('alice', ['a'], '/space/other')).toBe('a');
});
