import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import { fireEvent } from '@solidjs/testing-library';
import fc from 'fast-check';

function setup(cells = Array.from({ length: 42 }, () => 0)) {
  return render(() => (
    <DiscDropBoard
      cells={cells}
      columns={7}
      rows={6}
      active={1}
      winning={[]}
      interactive
      label="Connect Four"
      prompt="Choose a column"
      fullColumnPrompt={(column) =>
        `Column ${column + 1} is full. Choose another column.`
      }
      testId="board"
      columnTestId={(column) => `column-${column}`}
      columnLabel={(column) => `Column ${column + 1}`}
      cellLabel={(column, row) => `${column}, ${row}`}
      onDrop={() => undefined}
    />
  ));
}

// regression: connect-four-pointer-leave-clears-keyboard-preview
test('leaving a hovered column restores the keyboard landing preview', () => {
  const view = setup();
  const focused = view.getByTestId('column-2');
  const hovered = view.getByTestId('column-5');
  focused.focus();
  expect(view.getByTestId('board')).toHaveAttribute('data-preview-cell', '2');
  fireEvent.pointerEnter(hovered);
  expect(view.getByTestId('board')).toHaveAttribute('data-preview-cell', '5');
  fireEvent.pointerLeave(hovered);
  expect(document.activeElement).toBe(focused);
  expect(view.getByTestId('board')).toHaveAttribute('data-preview-cell', '2');
  focused.blur();
  expect(view.getByTestId('board')).toHaveAttribute('data-preview-cell', '-1');
  view.unmount();
});

// regression: connect-four-keyboard-drop-mismatched-preview
test('keyboard activation restores its focused destination before dropping', () => {
  const view = setup();
  const focused = view.getByTestId('column-2');
  focused.focus();
  fireEvent.pointerEnter(view.getByTestId('column-5'));
  fireEvent.keyDown(focused, { key: 'Enter' });
  expect(view.getByTestId('board').getAttribute('data-preview-cell')).toBe('2');
  view.unmount();
});

// regression: connect-four-full-column-silent-feedback
test('a full-column focus explains refusal and restores the instruction on exit', () => {
  const view = setup(
    Array.from({ length: 42 }, (_, index) => (index % 7 === 0 ? 1 : 0))
  );
  const full = view.getByTestId('column-0');
  full.focus();
  expect(view.getByTestId('board-prompt').textContent).toBe(
    'Column 1 is full. Choose another column.'
  );
  const before = view.getByTestId('board').getAttribute('data-cells');
  fireEvent.click(full);
  expect(view.getByTestId('board').getAttribute('data-cells')).toBe(before);
  full.blur();
  expect(view.getByTestId('board-prompt').textContent).toBe('Choose a column');
  view.unmount();
});

test('the landing preview restores any focused column after hover or cancellation', () => {
  assertProperty(
    'connect-four-preview-input-ownership',
    fc.property(
      fc.integer({ min: 0, max: 6 }),
      fc.integer({ min: 0, max: 6 }),
      fc.boolean(),
      fc.constantFrom('Enter', ' '),
      (focused, hovered, canceled, key) => {
        const view = setup();
        try {
          view.getByTestId(`column-${focused}`).focus();
          const pointer = view.getByTestId(`column-${hovered}`);
          fireEvent.pointerEnter(pointer);
          fireEvent.keyDown(view.getByTestId(`column-${focused}`), { key });
          expect(
            view.getByTestId('board').getAttribute('data-preview-cell')
          ).toBe(String(focused));
          fireEvent.pointerEnter(pointer);
          if (canceled) fireEvent.pointerCancel(pointer);
          else fireEvent.pointerLeave(pointer);
          expect(
            view.getByTestId('board').getAttribute('data-preview-cell')
          ).toBe(String(focused));
        } finally {
          view.unmount();
        }
      }
    )
  );
});
