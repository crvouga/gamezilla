import { afterEach, expect, test } from 'bun:test';
import { LightCyclesBoardView } from '@libs/light-cycles-client-ts/light-cycles-board-view';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

// regression: light-cycles-interrupted-swipe-replayed
test('an interrupted swipe cannot turn a rider after steering resumes', () => {
  const [stale, setStale] = createSignal(false);
  const inputs: unknown[] = [];
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <LightCyclesBoardView
        position={lightCyclesPositionCodec(3).encode(lightCyclesStart(3, 3))}
        orientation="white"
        interactive={true}
        sound={false}
        syncKey={0}
        testId="arena"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => {}}
        simulation={{
          paused: false,
          get stale() {
            return stale();
          },
          sides: ['white'],
          onInput: (side, input) => inputs.push([side, input]),
          onRelease: () => {},
        }}
      />
    </ThemeProvider>
  ));
  const arena = view.getByTestId('arena-arena');
  arena.setPointerCapture = () => {};
  const pointer = (type: string, x: number) =>
    fireEvent(
      arena,
      new PointerEvent(type, {
        pointerId: 7,
        pointerType: 'touch',
        clientX: x,
        clientY: 80,
        bubbles: true,
        button: 0,
      })
    );
  pointer('pointerdown', 100);
  setStale(true);
  setStale(false);
  pointer('pointermove', 140);
  expect(inputs).toEqual([]);
  pointer('pointerup', 140);
  pointer('pointerdown', 100);
  pointer('pointermove', 140);
  expect(inputs).toEqual([['white', { round: 1, heading: 'right' }]]);
});
