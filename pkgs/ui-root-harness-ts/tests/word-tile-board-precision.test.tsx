import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-phone-precision-default
// regression: word-tiles-map-fine-target-detour
test('390px phone starts precise and a1–e5 navigation focuses c3 without activating it', () => {
  const previous = window.matchMedia;
  const phone = previous.call(window, '(max-width: 639px)');
  Object.defineProperty(phone, 'matches', { value: true });
  window.matchMedia = () => phone;
  const activated: string[] = [];
  try {
    const view = render(() => (
      <WordTileBoard
        label="Phone board"
        testId="phone"
        columnLabels={'abcdefghijklmno'.split('')}
        rowLabels={Array.from({ length: 15 }, (_, i) => String(i + 1))}
        cells={Array.from({ length: 225 }, (_, i) => ({
          id: `${String.fromCharCode(97 + (i % 15))}${Math.floor(i / 15) + 1}`,
          letter: '',
          points: null,
          square: null,
          state: 'empty',
          label: String(i),
          enabled: true,
        }))}
        squareText={() => ''}
        onActivate={(id) => activated.push(id)}
      />
    ));
    expect(view.getByTestId('phone').getAttribute('data-enlarged')).toBe(
      'true'
    );
    expect(view.getAllByRole('button', { name: /^View / })).toHaveLength(9);
    fireEvent.click(view.getByRole('button', { name: 'View a1 to e5' }));
    expect(document.activeElement).toBe(view.getByTestId('phone-cell-c3'));
    expect(activated).toEqual([]);
    expect(view.queryByRole('dialog')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Fit board' }));
    expect(view.getByTestId('phone').getAttribute('data-enlarged')).toBe(
      'false'
    );
    view.unmount();
  } finally {
    window.matchMedia = previous;
  }
});
