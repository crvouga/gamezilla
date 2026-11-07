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
    opacity: 0.8,
  });
  expect(arrows[1]).toEqual({
    from: 'c3',
    to: 'd5',
    id: 'rec:watcher',
    color: 'primary',
  });
});

// regression: chess-puzzle-solution-move-indistinct
test('the revealed f3-e5 move frames both pieces without covering their centers', () => {
  const marks = puzzleBoardFeedback({
    wrong: null,
    hint: null,
    solution: { from: 'f3', to: 'e5' },
  });
  expect(marks).toEqual({
    f3: {
      kind: 'dot',
      shape: 'outline',
      label: 'Solution: move from f3 to e5',
    },
    e5: { kind: 'dot', shape: 'outline', label: 'Solution destination: e5' },
  });
});

test('nullable solution endpoints do not invent a marked square', () => {
  for (const solution of [
    { from: null, to: 'e5' },
    { from: 'f3', to: null },
  ]) {
    expect(puzzleBoardFeedback({ wrong: null, hint: 'f3', solution })).toEqual({
      f3: {
        kind: 'dot',
        corner: 'center',
        shape: 'outline',
        label: 'Hint: move this piece',
      },
    });
  }
});
