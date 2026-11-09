import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@solidjs/testing-library';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '../src/game-move-list/index';

afterEach(cleanup);

const sample: GameMoveListEntry[] = [
  {
    ply: 1,
    label: '4',
    swatch: { mark: '●' },
    accessibleName: '4',
    testId: 's1',
  },
  {
    ply: 2,
    label: '4',
    swatch: { mark: '◆' },
    accessibleName: '4',
    testId: 's2',
  },
];

function view(moves: GameMoveListEntry[], withSample: boolean) {
  return render(() => (
    <GameMoveList
      moves={moves}
      perTurn={2}
      current={moves.at(-1)?.ply ?? 0}
      layout="turn"
      aria-label="Moves"
      wrap
      onSelect={() => undefined}
      emptyTurn={
        withSample ? { sample, label: <span>No moves yet.</span> } : undefined
      }
    />
  ));
}

// regression: record-empty-well-grows-on-first-move
test('an empty turn strip shows its label over an unseen, inert sample first turn', () => {
  const empty = view([], true);
  const reserve = empty.container.querySelector(
    '[data-testid="game-move-list-empty-reserve"]'
  );
  expect(empty.container.textContent).toContain('No moves yet.');
  expect(reserve?.getAttribute('aria-hidden')).toBe('true');
  expect(reserve?.hasAttribute('inert')).toBe(true);
  expect(reserve?.querySelectorAll('button')).toHaveLength(2);
  // The sample never lends its test ids to the page.
  expect(empty.container.querySelector('[data-testid="s1"]')).toBeNull();
  cleanup();
  const played = view(sample.slice(0, 1), true);
  expect(
    played.container.querySelector(
      '[data-testid="game-move-list-empty-reserve"]'
    )
  ).toBeNull();
  cleanup();
  const plain = view([], false);
  expect(
    plain.container.querySelector(
      '[data-testid="game-move-list-empty-reserve"]'
    )
  ).toBeNull();
});
