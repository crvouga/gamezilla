/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { CELLS } from '@libs/battleship-shared-ts/battleship-board';
import { BATTLESHIP_PREFIX } from '@libs/battleship-shared-ts/battleship-position';
import { GameBoardPreviewContext } from '@pkgs/ui-root-client-ts/game-board-stage/board-preview';
import { byTestId, renderBoard } from './render';

// regression: battleship-lobby-picture-collapses
test('as a lobby’s picture the game is one side’s waters, with nothing to press', () => {
  const { container } = renderBoard(() => (
    <GameBoardPreviewContext.Provider value={() => true}>
      <BattleshipBoard
        position={BATTLESHIP_PREFIX}
        orientation="white"
        interactive={false}
        sound={false}
        syncKey={0}
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        testId="picture"
        onAction={() => undefined}
      />
    </GameBoardPreviewContext.Provider>
  ));
  // The pair's switch and its keys are taller than any room a picture is
  // given: the board fitted to that room shrank to nothing.
  expect(
    container.querySelectorAll('[data-component="CellGridBoard"]')
  ).toHaveLength(1);
  expect(container.querySelector('[data-component="PairedPanels"]')).toBeNull();
  expect(
    container.querySelector('[data-component="SegmentedControl"]')
  ).toBeNull();
  expect(byTestId('picture').getAttribute('aria-label')).toBe(
    'Blue fleet waters'
  );
  for (const cell of CELLS) expect(byTestId(`picture-${cell}`)).not.toBeNull();
});
