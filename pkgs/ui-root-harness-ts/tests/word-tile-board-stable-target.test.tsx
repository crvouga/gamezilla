import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-focus-moves-pointer-target
test('focusing an already visible precision cell keeps it under the pointer', () => {
  const activated: string[] = [];
  const view = render(() => (
    <WordTileBoard
      label="Stable word board"
      testId="stable"
      columnLabels={['a', 'b', 'c']}
      rowLabels={['1', '2', '3']}
      cells={Array.from({ length: 9 }, (_, index) => ({
        id: `${String.fromCharCode(97 + (index % 3))}${Math.floor(index / 3) + 1}`,
        label: `Square ${index}`,
        letter: '',
        points: null,
        square: null,
        state: 'empty',
        enabled: true,
      }))}
      squareText={() => ''}
      onActivate={(id) => activated.push(id)}
    />
  ));
  fireEvent.click(view.getByRole('button', { name: 'Enlarge board' }));
  const viewport = view.getByRole('region', { name: 'Scrollable word board' });
  const target = view.getByTestId('stable-cell-a2');
  // A visible 44px target, left of center in a 200px scroll viewport.
  viewport.getBoundingClientRect = () => new DOMRect(0, 0, 200, 200);
  target.getBoundingClientRect = () => new DOMRect(32, 64, 44, 44);
  viewport.scrollLeft = 80;
  viewport.scrollTop = 80;
  target.focus();
  expect(viewport.scrollLeft).toBe(80);
  expect(viewport.scrollTop).toBe(80);
  fireEvent.click(target);
  expect(activated).toEqual(['a2']);
});
