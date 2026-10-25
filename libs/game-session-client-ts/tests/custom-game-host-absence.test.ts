import { expect, test } from 'bun:test';
import { customGameHostKnownAbsent } from '@libs/game-session-client-ts/custom-game-host-absence';

const host = { id: 'alice', clientId: 'alice-phone' };
const view = {
  connected: true,
  hasRoster: true,
  hostId: 'alice',
  myId: 'bob',
  roster: [{ id: 'bob', clientId: 'bob-phone' }],
};

test('a guest who has just joined does not take the host for absent', () => {
  // regression: custom-game-choice-refused-before-roster-arrives
  expect(
    customGameHostKnownAbsent({ ...view, roster: [], hasRoster: false })
  ).toBe(false);
  expect(customGameHostKnownAbsent({ ...view, connected: false })).toBe(false);
  // Once the room says who is present, a missing host is known.
  expect(customGameHostKnownAbsent(view)).toBe(true);
  expect(customGameHostKnownAbsent({ ...view, roster: [host] })).toBe(false);
  expect(customGameHostKnownAbsent({ ...view, myId: 'alice' })).toBe(false);
});
