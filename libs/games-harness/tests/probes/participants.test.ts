/**
 * Probe: more than two participants.
 *
 * Limitation (executable, type-level and by law). A turn game has two
 * seats: `GameSide` is `'white' | 'black'`, a game record names a pair of
 * participants, and every action passes the turn to the other of the two
 * (the turn law). Behind them: a custom game's two seats and per-side
 * clocks (`CustomGame.white` / `.black`, `remaining`), a matched game's
 * `white_id` / `black_id` and pairing of two searches, and ratings between
 * two people. A game for three or more registers its own room behaviour
 * and screens (`GameOwnRoom`, `defineGameClient({ screens })`) beside the
 * shared ones, and none of the shared turn-game lifecycles serve it; a
 * shared multi-seat session would be a new shared module and capability
 * with seats as data (design-only — no probe exercises it).
 */

import { expect, test } from 'bun:test';
import type {
  GameRecordMetadata,
  GameSide,
} from '@pkgs/turn-game-shared/game-rules';

test('a turn game seats two sides, and a game record names two people', () => {
  const sides: GameSide[] = ['white', 'black'];
  // @ts-expect-error: a third seat is no side of a turn game.
  sides.push('red');
  const pair: GameRecordMetadata['participants'] = [
    { name: 'Alice', rating: null },
    { name: 'Bob', rating: null },
  ];
  const carol = { name: 'Carol', rating: null };
  // @ts-expect-error: a game record names exactly two participants.
  const trio: GameRecordMetadata['participants'] = [...pair, carol];
  expect([sides.length, trio.length]).toEqual([3, 3]);
});
