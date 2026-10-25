import { expect, test } from 'bun:test';
import {
  simulationRoomChoice,
  simulationRoomFixture,
  simulationRoomGame,
} from '@libs/game-session-harness-ts/simulation-room-fixture';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { networkRace } from './network-race';

const clock = { now: () => 0 };
const random = () => 0;

function stateOf(players?: readonly (string | null)[]) {
  return simulationRoomFixture(
    {
      game: networkRace,
      id: 'race-1',
      viewers: ['eve'],
      ...(players === undefined ? {} : { players }),
    },
    clock,
    random
  ).initialState();
}

function current(players?: readonly (string | null)[]) {
  const state = stateOf(players);
  return {
    game: CustomGamesAttr.from(state).current!,
    members: Object.keys(SpaceMembersRoomAttr.seats.from(state)).sort(),
  };
}

test('the fixture seats Alice and Bob by default', () => {
  const { game, members } = current();
  expect(game.status).toBe('active');
  expect(game.white).toEqual({ kind: 'person', person: 'alice' });
  expect(game.black).toEqual({ kind: 'person', person: 'bob' });
  expect(game.ready).toEqual(['white', 'black']);
  expect(members).toEqual(['alice', 'bob', 'eve']);
});

test('the fixture fills seats in order with people or bots', () => {
  const { game, members } = current(['carol', null]);
  expect(game.creator).toBe('carol');
  expect(game.white).toEqual({ kind: 'person', person: 'carol' });
  expect(game.black.kind).toBe('bot');
  expect(members).toEqual(['carol', 'eve']);
});

test('the fixture refuses a roster that does not match the seats', () => {
  expect(() => current(['alice'])).toThrow('one player for every seat');
  expect(() => current([null, null])).toThrow('at least one person');
});

test('the fixture reads its game and sends a choice where the screen would', () => {
  const shared = stateOf();
  expect(simulationRoomGame(shared)).toEqual({
    id: 'race-1',
    revision: 0,
    status: 'active',
  });
  const online = simulationRoomChoice(networkRace, shared, 'rematch', 5);
  expect(ChangeCustomGame.is(online)).toBe(true);
  expect(online.payload).toEqual({
    gameId: 'race-1',
    revision: 0,
    operation: 'rematch',
  });
  const practice = simulationRoomChoice(
    networkRace,
    stateOf(['alice', null]),
    'start',
    5
  );
  expect(ChangeLocalCustomGame.is(practice)).toBe(true);
  expect(practice.payload).toEqual({
    choice: { gameId: 'race-1', revision: 0, operation: 'start' },
    at: 5,
  });
});
