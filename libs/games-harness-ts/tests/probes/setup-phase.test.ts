/**
 * Probe: a setup phase distinct from active play.
 *
 * Supported (executable), as ordinary turns: each side's setup choice is an
 * action of the rules and the setup is part of the position, so replay,
 * legality, the move list, bots and automation, review and history carry it
 * with no framework change, and the game inherits every custom-game suite
 * and specification.
 *
 * Limitation (design-only): the platform has no notion of a phase. A setup
 * action is a move to every shared lifecycle: it starts and spends the
 * clocks, it is listed and numbered with the moves, and in a matched game
 * the first two setup actions close the abort window (`bothHaveMoved`). A
 * setup made at once or hidden from the other side (Battleship's fleet) is
 * the private-state boundary (`private-state.test.ts`).
 */

import { expect, test } from 'bun:test';
import { refusals } from '../reference-game/faulty-game';
import { areasOf, inheritedSpecifications } from './probe-verdict';
import { SETUP_RACE_GAME, SETUP_RACE_RULES } from './setup-race-game';

// regression: game-conformance-fault-probes-production-default
test('a game opening with a setup phase keeps every law', () => {
  expect([...refusals(SETUP_RACE_GAME).keys()]).toEqual([]);
});

test('setup actions are moves: listed, replayed and refused before play like any other', () => {
  const rules = SETUP_RACE_RULES;
  const line = ['pick-2', 'pick-1', 'run'];
  expect(rules.legal(rules.initial())).toEqual(['pick-1', 'pick-2']);
  expect(rules.play(rules.initial(), 'run', '', [])).toBeNull();
  expect(
    rules
      .moves(rules.replay(line, line.length), '', line)
      .map((move) => move.label)
  ).toEqual(['stride 2', 'stride 1', 'run to 2']);
});

test('it inherits the custom-game specifications and owes nothing for what it does not offer', () => {
  expect(areasOf(SETUP_RACE_GAME).bound).toEqual(['rules', 'custom-games']);
  const specifications = inheritedSpecifications(SETUP_RACE_GAME);
  expect(specifications).toContain('specs/games/game-turns.feature');
  expect(specifications).toContain('specs/games/custom-game-play.qnt');
  expect(specifications).not.toContain('specs/games/game-history.feature');
});
