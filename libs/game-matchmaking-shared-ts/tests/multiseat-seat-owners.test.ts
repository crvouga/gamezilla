import { expect, test } from 'bun:test';
import {
  multiplayerSeatOwners,
  rotatedSeatOwners,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { multiseatGame } from './multiseat-fixture';

const three = ['white', 'black', 'red'] as const;
const four = ['white', 'black', 'red', 'blue'] as const;

test('a three-seat match fills white, black and red and leaves blue closed', () => {
  expect(multiplayerSeatOwners(three, ['alice', 'bob', 'carol'])).toEqual({
    whiteId: 'alice',
    blackId: 'bob',
    redId: 'carol',
  });
});

test('a four-seat match fills every declared seat in order', () => {
  expect(
    multiplayerSeatOwners(four, ['alice', 'bob', 'carol', 'dave'])
  ).toEqual({
    whiteId: 'alice',
    blackId: 'bob',
    redId: 'carol',
    blueId: 'dave',
  });
});

test('a roster that does not fill each declared seat once is refused', () => {
  expect(() => multiplayerSeatOwners(three, ['alice', 'bob'])).toThrow(
    'exactly one person'
  );
  expect(() =>
    multiplayerSeatOwners(['black', 'white'], ['alice', 'bob'])
  ).toThrow('exactly one person');
});

test('a three-seat rematch moves each person one seat along the order', () => {
  const game = multiseatGame({ blue_id: null });
  expect(rotatedSeatOwners(game, three)).toEqual({
    whiteId: 'carol',
    blackId: 'alice',
    redId: 'bob',
  });
});

test('a four-seat rematch keeps all four people', () => {
  expect(rotatedSeatOwners(multiseatGame(), four)).toEqual({
    whiteId: 'dave',
    blackId: 'alice',
    redId: 'bob',
    blueId: 'carol',
  });
});
