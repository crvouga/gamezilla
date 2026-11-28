import { expect, test } from 'bun:test';
import { gameSessionHostKnownAbsent } from '@libs/game-session-client-ts/game-session-host-absence';

const host = { id: 'alice', clientId: 'alice-phone' };
const view = {
  connected: true,
  hasRoster: true,
  hostId: 'alice',
  myId: 'bob',
  roster: [{ id: 'bob', clientId: 'bob-phone' }],
};

test('a guest who has just joined does not take the host for absent', () => {
  // regression: game-session-choice-refused-before-roster-arrives
  expect(
    gameSessionHostKnownAbsent({ ...view, roster: [], hasRoster: false })
  ).toBe(false);
  expect(gameSessionHostKnownAbsent({ ...view, connected: false })).toBe(false);
  // Once the room says who is present, a missing host is known.
  expect(gameSessionHostKnownAbsent(view)).toBe(true);
  expect(gameSessionHostKnownAbsent({ ...view, roster: [host] })).toBe(false);
  expect(gameSessionHostKnownAbsent({ ...view, myId: 'alice' })).toBe(false);
});
