import { expect, test } from 'bun:test';
import { puzzleBoardArrows } from '@libs/chess-puzzle-client-ts/puzzle-board-arrows';
import { puzzleBoardFeedback } from '@libs/chess-puzzle-client-ts/puzzle-board-feedback';

// regression: chess-puzzle-hint-obscures-knight
test('the f3 hint leaves the knight center clear and preserves wrong-move feedback', () => {
  expect(puzzleBoardFeedback({ hint: 'f3', wrong: 'e4' })).toEqual({
    e4: { kind: 'cross' },
    f3: {
      kind: 'dot',
      corner: 'center',
      shape: 'outline',
      label: 'Hint: move this piece',
    },
  });
});

// regression: chess-puzzle-solution-covers-pieces
test('the f3-e5 solution uses a narrow translucent arrow while watcher suggestions retain their style', () => {
  const arrows = puzzleBoardArrows({
    solution: { from: 'f3', to: 'e5' },
    suggestions: [{ by: 'watcher', from: 'c3', to: 'd5', color: 'primary' }],
  });
  expect(arrows[0]).toEqual({
    from: 'f3',
    to: 'e5',
    id: 'puzzle-solution',
    thickness: 0.06,
    opacity: 0.55,
  });
  expect(arrows[1]).toEqual({
    from: 'c3',
    to: 'd5',
    id: 'rec:watcher',
    color: 'primary',
  });
});
