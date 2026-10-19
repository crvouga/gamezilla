/**
 * Probe: participant-specific private state.
 *
 * Limitation (executable). A game's whole state is one opaque position,
 * and every participant and watcher is given the same one: the custom-game
 * state is a room attribute shared with everyone in the space, a matched
 * game's `fen` is read by both people and its watchers, and a board is
 * given that position with no viewer (`GameBoardProps`), as the rules
 * decide and list actions with no actor (`GameRules.play`, `legal`). A
 * hand of cards or a hidden fleet would be seen by everyone. Extending it
 * means a per-viewer projection of the position in the rules contract
 * (`view(position, side)`), applied by the room before a position leaves
 * it, by the matched-game reads, and to bots and the puzzle session.
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { readCustomGameScreen } from '@libs/game-session-harness/custom-game-screen';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import type { GameBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type { GameRules } from '@pkgs/turn-game-shared/game-rules';
import { MISERE_TALLY_GAME } from './misere-tally-game';

test('a board is given the position, never a viewer; rules decide with no actor', () => {
  const props: GameBoardProps = {
    position: 'misere-tally:0w',
    orientation: 'white',
    interactive: true,
    sound: false,
    syncKey: 0,
    onAction: () => {},
    testId: 'board',
    // @ts-expect-error: the board has no viewer to hide anything from.
    viewer: 'black',
  };
  const rules: GameRules = MISERE_TALLY_GAME.shared.turnGame.rules;
  // @ts-expect-error: legal actions are the position's, not a side's view.
  rules.legal(props.position, 'black');
  expect(props.position).toBe(rules.initial());
});

const SYSTEM = gameSystem('misere-tally-private', [MISERE_TALLY_GAME]);

test('both sides and a watcher are shown the one position', async () => {
  await using s = await openGameHarness(SYSTEM, 'private-state-probe');
  await s.apply(establishCustomGame, 'misere-tally', {
    watchers: ['carol'],
    moves: ['two'],
  });
  const positions: (string | undefined)[] = [];
  for (const person of ['alice', 'bob', 'carol'])
    positions.push((await s.read(readCustomGameScreen, person))?.position);
  expect(positions).toEqual([
    'misere-tally:2b',
    'misere-tally:2b',
    'misere-tally:2b',
  ]);
}, 120_000);
