import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { fireEvent, waitFor, within } from '@solidjs/testing-library';

// regression: word-tiles-phone-precision-default
// regression: word-tiles-map-fine-target-detour
test('390px phone starts precise and a1–e5 navigation focuses c3 without activating it', async () => {
  const previous = window.matchMedia;
  const phone = previous.call(window, '(max-width: 639px)');
  Object.defineProperty(phone, 'matches', { value: true });
  window.matchMedia = () => phone;
  const activated: string[] = [];
  try {
    const { clock, timers } = createHarnessClock();
    const view = render(() => (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider fixedLayout={{ width: 390, height: 844 }}>
          <SurfaceStackProvider>
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
          </SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    ));
    expect(view.getByTestId('phone').getAttribute('data-enlarged')).toBe(
      'true'
    );
    // The view tools wait behind one Board tools button under the board.
    expect(view.queryByRole('button', { name: 'Fit board' })).toBeNull();
    fireEvent.click(
      view.getByRole('button', { name: 'Board tools: zoom and find a square' })
    );
    const tools = within(view.getByRole('dialog', { name: 'Board tools' }));
    expect(
      tools.getAllByRole('button', { name: /^View \w+ to / })
    ).toHaveLength(9);
    fireEvent.click(tools.getByRole('button', { name: 'View a1 to e5' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(view.getByTestId('phone-cell-c3'))
    );
    expect(activated).toEqual([]);
    expect(view.queryByRole('dialog')).toBeNull();
    fireEvent.click(
      view.getByRole('button', { name: 'Board tools: zoom and find a square' })
    );
    fireEvent.click(view.getByRole('button', { name: 'Fit board' }));
    expect(view.queryByRole('dialog')).toBeNull();
    expect(view.getByTestId('phone').getAttribute('data-enlarged')).toBe(
      'false'
    );
    // The chosen square keeps focus once the dialog has let go of it.
    await waitFor(() =>
      expect(document.activeElement).toBe(view.getByTestId('phone-cell-c3'))
    );
    view.unmount();
  } finally {
    window.matchMedia = previous;
  }
});
