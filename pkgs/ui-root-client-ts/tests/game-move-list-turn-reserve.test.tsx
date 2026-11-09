import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@solidjs/testing-library';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '../src/game-move-list/index';

afterEach(cleanup);

const move = (ply: number): GameMoveListEntry => ({
  ply,
  label: String(ply),
  swatch: { mark: ply % 2 === 1 ? '●' : '◆' },
  accessibleName: `Move ${String(ply)}`,
  testId: `move-${String(ply)}`,
});

function reserves(moves: GameMoveListEntry[], wrap: boolean) {
  const view = render(() => (
    <GameMoveList
      moves={moves}
      perTurn={2}
      current={moves.at(-1)?.ply ?? 0}
      layout="turn"
      aria-label="Moves"
      wrap={wrap}
      onSelect={() => undefined}
    />
  ));
  const found = [
    ...view.container.querySelectorAll(
      '[data-testid="game-move-list-reserve"]'
    ),
  ];
  cleanup();
  return found;
}

// regression: record-strip-turn-height-changes
test('a wrapping turn keeps room for its moves still to come, unseen and inert', () => {
  const half = reserves([move(1), move(2), move(3)], true);
  expect(half).toHaveLength(1);
  expect(half[0]?.getAttribute('aria-hidden')).toBe('true');
  expect(half[0]?.hasAttribute('inert')).toBe(true);
  expect(reserves([move(1), move(2), move(3), move(4)], true)).toHaveLength(0);
  expect(reserves([move(1), move(2), move(3)], false)).toHaveLength(0);
});
