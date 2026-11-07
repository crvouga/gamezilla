import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import {
  WordTileBoard,
  type WordTileBoardCell,
} from '@pkgs/ui-root-client-ts/word-tile-board';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

test('enlarging retains the chosen coordinate and placement through fit changes', () => {
  // regression: word-tiles-enlarged-coordinate-retention
  const [placed, setPlaced] = createSignal('');
  const cells = (): WordTileBoardCell[] => {
    const selected = placed();
    return Array.from({ length: 225 }, (_, index) => {
      const id = `${String.fromCharCode(97 + (index % 15))}${Math.floor(index / 15) + 1}`;
      return {
        id,
        label: id,
        letter: selected === id ? 'A' : '',
        points: selected === id ? 1 : null,
        state: selected === id ? 'tentative' : 'empty',
        square: index === 112 ? 'start' : null,
        enabled: true,
      };
    });
  };
  const view = render(() => (
    <WordTileBoard
      label="Placement board"
      testId="placement"
      columnLabels={'abcdefghijklmno'.split('')}
      rowLabels={Array.from({ length: 15 }, (_, i) => String(i + 1))}
      cells={cells()}
      squareText={() => '★'}
      onActivate={setPlaced}
    />
  ));
  const center = view.getByTestId('placement-cell-h8');
  center.focus();
  fireEvent.keyDown(center, { key: 'ArrowRight' });
  const target = view.getByTestId('placement-cell-i8');
  expect(document.activeElement).toBe(target);
  fireEvent.click(view.getByRole('button', { name: 'Enlarge board' }));
  expect(document.activeElement).toBe(target);
  expect(view.getByTestId('placement').getAttribute('data-enlarged')).toBe(
    'true'
  );
  fireEvent.click(target);
  expect(target.getAttribute('data-state')).toBe('tentative');
  expect(center.textContent).toBe('★');
  fireEvent.click(view.getByRole('button', { name: 'Fit board' }));
  expect(document.activeElement).toBe(target);
  expect(target.getAttribute('data-state')).toBe('tentative');
  expect(view.getByTestId('placement').getAttribute('data-enlarged')).toBe(
    'false'
  );
});
