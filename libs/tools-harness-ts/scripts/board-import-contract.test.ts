import { expect, test } from 'bun:test';
import { permittedBoardImport } from './board-import-contract';

// regression: public-chess-board-frame-rejected
test('puzzle board composition and deterministic story motion use public contracts', () => {
  expect(
    permittedBoardImport(
      'chess-puzzle-board.tsx',
      false,
      '@pkgs/chess-board-root-client-ts/chess-board-frame'
    )
  ).toBe(true);
  expect(
    permittedBoardImport(
      'chess-puzzle-story.example.tsx',
      false,
      '@pkgs/chess-board-root-client-ts/board-motion-context'
    )
  ).toBe(true);
});

test('internal board modules and production motion overrides stay forbidden', () => {
  expect(
    permittedBoardImport(
      'chess-puzzle-board.tsx',
      false,
      '@pkgs/chess-board-root-client-ts/board-motion-context'
    )
  ).toBe(false);
  expect(
    permittedBoardImport(
      'chess-puzzle-story.example.tsx',
      false,
      '@pkgs/chess-board-root-client-ts/chess-board-pointer'
    )
  ).toBe(false);
  expect(
    permittedBoardImport(
      'chess-puzzle-board.tsx',
      false,
      '@pkgs/chess-board-core-shared-ts/types'
    )
  ).toBe(false);
  expect(
    permittedBoardImport(
      'chess-puzzle-board.tsx',
      true,
      '@pkgs/chess-board-core-shared-ts/types'
    )
  ).toBe(true);
});
