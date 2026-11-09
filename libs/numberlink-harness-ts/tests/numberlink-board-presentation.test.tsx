import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NumberlinkPlayer } from '@libs/numberlink-client-ts/numberlink-player';
import {
  FIVE_BY_FIVE,
  SOLUTION,
} from '@libs/numberlink-client-ts/numberlink-player.example';
import { endpointLines } from '@pkgs/ui-root-client-ts/path-grid-board';
import { fireEvent } from '@solidjs/testing-library';
import { playerFixture, renderNumberlink } from './numberlink-client-fixture';

const BOARD_CSS = readFileSync(
  join(
    import.meta.dirname,
    '../../../pkgs/ui-root-client-ts/src/path-grid-board/path-grid-board.module.css'
  ),
  'utf8'
);

function declared(selector: string, property: string): string | undefined {
  const start = BOARD_CSS.indexOf(`${selector} {`);
  if (start < 0) return undefined;
  const body = BOARD_CSS.slice(
    BOARD_CSS.indexOf('{', start) + 1,
    BOARD_CSS.indexOf('}', start)
  );
  return body
    .split(';')
    .map((line) => line.trim().split(':'))
    .find(([name]) => name?.trim() === property)?.[1]
    ?.trim();
}

// regression: numberlink-solved-notice-shifts-board
test('solving announces itself below the board, so the board does not move', () => {
  const view = renderNumberlink(() => (
    <NumberlinkPlayer
      definition={JSON.stringify(FIVE_BY_FIVE)}
      state={JSON.stringify({ paths: SOLUTION })}
      disabled={false}
      onAction={() => undefined}
    />
  ));
  try {
    const board = view.getByTestId('numberlink-board');
    const solved = view.getByTestId('numberlink-solved');
    expect(
      board.compareDocumentPosition(solved) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(solved.textContent).toContain('shown above');
  } finally {
    view.unmount();
  }
});

// regression: numberlink-focus-hidden-on-filled-endpoint
test('keyboard focus paints above endpoints with a two-tone edge', () => {
  const focus = Number(declared('.cell:focus-visible::before', 'z-index'));
  const endpoint = Number(declared('.endpoint', 'z-index'));
  expect(focus).toBeGreaterThan(endpoint);
  expect(declared('.cell:focus-visible::before', 'box-shadow')).toContain(
    'inset'
  );
});

// regression: numberlink-long-labels-split-without-hyphen
test('long labels break at a space, or mid-word with a hyphen', () => {
  expect(endpointLines('SUNRISES')).toEqual(['SUNR-', 'ISES']);
  expect(endpointLines('RED STAR')).toEqual(['RED', 'STAR']);
  expect(endpointLines('ABCD')).toEqual(['ABCD']);
  expect(endpointLines('20')).toEqual(['20']);
});

// regression: numberlink-focus-ring-shown-while-pointer-drawing
// Pointer drawing focuses its start cell from script so Escape reaches it;
// browsers count that as keyboard focus, so the keyboard ring showed under
// a finger or mouse for the whole drawing.
test('the focus ring belongs to the keyboard, not to pointer drawing', () => {
  const f = playerFixture();
  try {
    f.pointer('pointerdown', 0);
    expect(f.board.getAttribute('data-input')).toBe('pointer');
    f.pointer('pointerup', 0);
    fireEvent.keyDown(f.view.getByTestId('numberlink-board-cell-0'), {
      key: 'ArrowRight',
    });
    expect(f.board.getAttribute('data-input')).toBe('keyboard');
    expect(
      declared(
        '.board[data-input="pointer"] .cell:focus-visible::before',
        'content'
      )
    ).toBe('none');
  } finally {
    f.view.unmount();
  }
});
