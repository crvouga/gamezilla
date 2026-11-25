import { expect, test } from 'bun:test';
import {
  claimFixtureUsername,
  fixtureUsername,
} from '@libs/profile-harness-ts/remembered-username';

// regression: offline-profile-fixture-claims-another-worlds-username
test('two worlds can hold alice_one while a duplicate claim in one world still collides', () => {
  const first = { memo: new Map<string, unknown>() };
  const second = { memo: new Map<string, unknown>() };
  const name = claimFixtureUsername(first, 'alice_one', 'a46f5e12');
  expect(name).toBe('alice_one_a46f5e12');
  expect(claimFixtureUsername(second, 'alice_one', 'e1fea536')).not.toBe(name);
  expect(fixtureUsername(first, 'ALICE_ONE').toLowerCase()).toBe(name);
  expect(fixtureUsername(first, 'official_support')).toBe('official_support');
  expect(claimFixtureUsername(first, 'knight_rider', null)).toBe(
    'knight_rider'
  );
  expect(claimFixtureUsername(first, 'knight_rider', 'a46f5e12')).toBe(
    'knight_rider'
  );
});
