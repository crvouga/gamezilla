import { expect, test } from 'bun:test';
import { multiplayerSettleDue } from '@libs/game-matchmaking-client-ts/multiplayer-settle-due';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';

/** A clockless live game (as Pong is matched): no deadline of its own. */
function liveGame(outcome: MultiplayerGame['outcome']): MultiplayerGame {
  return {
    id: 'live-match',
    white_id: 'cedar',
    black_id: 'bob',
    fen: 'counting-race:0',
    pgn: '',
    revision: 0,
    turn: '',
    outcome,
    reason: outcome === 'ongoing' ? null : 'target score',
    time_control: null,
    white_ms: null,
    black_ms: null,
    clock_at_ms: null,
    paused_at_ms: null,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: null,
    black_rating: null,
    white_rating_diff: null,
    black_rating_diff: null,
    setup_ready: null,
  };
}

test('a live result the durable game lacks is settled now, not at the next sweep', () => {
  // regression: live-match-result-waits-for-sweep
  const now = 1_717_200_000_000;
  // The room shows Cedar's win while the durable game is still ongoing.
  expect(
    multiplayerSettleDue(liveGame('white'), liveGame('ongoing'), now)
  ).toBe('live-match');
  // Once the durable game has the result, or nothing ended, nothing is due.
  expect(
    multiplayerSettleDue(liveGame('white'), liveGame('white'), now)
  ).toBeNull();
  expect(
    multiplayerSettleDue(liveGame('ongoing'), liveGame('ongoing'), now)
  ).toBeNull();
  // A room's result settles only the game it belongs to.
  expect(
    multiplayerSettleDue(
      liveGame('white'),
      { ...liveGame('ongoing'), id: 'another-match' },
      now
    )
  ).toBeNull();
  expect(multiplayerSettleDue(null, liveGame('ongoing'), now)).toBeNull();
  // A turn game's room only follows its durable game, which a move decides.
  expect(
    multiplayerSettleDue(
      { ...liveGame('white'), turn: 'bob' },
      { ...liveGame('ongoing'), turn: 'bob' },
      now
    )
  ).toBeNull();
});
