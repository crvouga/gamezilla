/**
 * Probe: participant-specific private state.
 *
 * Supported as private setups (`GameRules.setup`): each side prepares a
 * setup only it and the authority hold — a hidden fleet — and every
 * position stays public, because the authority resolves each proposal
 * with both setups into the public action it records. The room withholds a
 * setup from everyone but its person, a matched game's setups sync only to
 * their owner, a board is given only its viewer's own setup, and bots choose
 * from the public position alone. The test-only consumer secret pick and
 * Battleship are held to it (the `private-setup-privacy` suites of
 * custom games and finding an opponent, and the shared private-setup
 * specifications).
 *
 * Still a limitation (executable below): a position that differs per
 * viewer as play goes on — a hand of cards drawn during play, a fog that
 * lifts — since the shared position is one public string, the board takes
 * no per-viewer position, and rules decide with no actor.
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
