import { expect, test } from 'bun:test';
import {
  FIRST_MOVE_MS,
  multiplayerDeadlineMs,
  settleMultiplayerClock,
} from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import { multiplayerPeople } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { MULTISEAT_GAMES, multiseatGame } from './multiseat-fixture';

// regression: multiseat-early-expiry
test('a four-seat first-move deadline at revision zero completes a draw', () => {
  const finished = settleMultiplayerClock(
    multiseatGame(),
    FIRST_MOVE_MS,
    MULTISEAT_GAMES
  );
  expect([finished.outcome, finished.reason, finished.revision]).toEqual([
    'draw',
    'first move missed',
    0,
  ]);
  expect(multiplayerPeople(finished)).toEqual([
    'alice',
    'bob',
    'carol',
    'dave',
  ]);
});

test('a two-seat first-move deadline retains its aborted result', () => {
  const pair = multiseatGame({ red_id: null, blue_id: null });
  const finished = settleMultiplayerClock(pair, FIRST_MOVE_MS, MULTISEAT_GAMES);
  expect([finished.outcome, finished.reason]).toEqual([
    'aborted',
    'first move missed',
  ]);
});

test('four-seat expiry is drawn before and after every participant first moves', () => {
  assertProperty(
    'four-seat expiry preserves a drawn result at every active ply',
    fc.property(
      fc.integer({ min: 0, max: 6 }),
      fc.constantFrom('3+2', '1d'),
      fc.integer({ min: 0, max: 10_000 }),
      (revision, clock, lateMs) => {
        const people = ['alice', 'bob', 'carol', 'dave'];
        const game = multiseatGame({
          revision,
          fen: `four-seat-reference:${revision}`,
          turn: people[revision % 4]!,
          time_control: `four-seat-reference/${clock}`,
        });
        const deadline = multiplayerDeadlineMs(game)!;
        expect(
          settleMultiplayerClock(game, deadline - 1, MULTISEAT_GAMES)
        ).toBe(game);
        const finished = settleMultiplayerClock(
          game,
          deadline + lateMs,
          MULTISEAT_GAMES
        );
        expect(finished.outcome).toBe('draw');
        expect(multiplayerPeople(finished)).toEqual(people);
        expect(finished.fen).toBe(game.fen);
        expect(finished.revision).toBe(revision);
      }
    )
  );
});
