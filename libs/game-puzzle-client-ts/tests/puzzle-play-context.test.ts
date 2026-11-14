import { expect, test } from 'bun:test';
import { puzzlePlayContext } from '@libs/game-puzzle-client-ts/puzzle-play-context';

// regression: puzzle-player-repeats-shell-way-on
test('a player is told where it is played and whether the screen offers a way on', () => {
  expect(
    puzzlePlayContext({ mode: 'playtest', pack_revision_id: null })
  ).toEqual({
    kind: 'playtest',
    shellOffersWayOn: true,
    shellSaysSolved: true,
  });
  expect(
    puzzlePlayContext({ mode: 'ordinary', pack_revision_id: 'pack-revision' })
  ).toEqual({ kind: 'pack', shellOffersWayOn: true, shellSaysSolved: true });
  expect(
    puzzlePlayContext({ mode: 'ordinary', pack_revision_id: null })
  ).toEqual({
    kind: 'single',
    shellOffersWayOn: false,
    shellSaysSolved: true,
  });
});
