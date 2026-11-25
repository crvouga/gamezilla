import { afterEach, expect, test } from 'bun:test';
import { LightCyclesBoardView } from '@libs/light-cycles-client-ts/light-cycles-board-view';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';

afterEach(cleanup);

function touch(element: HTMLElement, type: string, id: number, x: number) {
  fireEvent(
    element,
    new PointerEvent(type, {
      pointerId: id,
      pointerType: 'touch',
      clientX: x,
      clientY: 110,
      button: 0,
      bubbles: true,
    })
  );
}

test('a watcher can lift one finger to pan and taking a rider follows their cycle with a fresh gesture', () => {
  const [riding, setRiding] = createSignal(false);
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
        testId="board"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => {}}
        simulation={{
          paused: false,
          stale: false,
          get sides(): readonly 'white'[] {
            return riding() ? ['white'] : [];
          },
          onInput: (side, input) => inputs.push([side, input]),
          onRelease: () => {},
        }}
      />
    </ThemeProvider>
  ));
  const surface = view.getByRole('application', { name: /Inspect arena/ });
  const arena = view.getByTestId('board-arena');
  const drawing = view.getByTestId('board-arena-drawing');
  const fit = drawing.getAttribute('viewBox');
  drawing.getBoundingClientRect = () => new DOMRect(0, 0, 400, 280);
  surface.setPointerCapture = () => {};
  surface.hasPointerCapture = () => true;
  arena.setPointerCapture = () => {};
  touch(surface, 'pointerdown', 1, 100);
  touch(surface, 'pointerdown', 2, 160);
  touch(surface, 'pointermove', 2, 220);
  expect(arena.getAttribute('data-zoom')).toBe('2');
  touch(surface, 'pointerup', 2, 220);
  const magnified = drawing.getAttribute('viewBox');
  touch(surface, 'pointermove', 1, 80);
  expect(drawing.getAttribute('viewBox')).not.toBe(magnified);
  setRiding(true);
  flush();
  expect(view.queryByRole('application', { name: /Inspect arena/ })).toBeNull();
  expect(drawing.getAttribute('viewBox')).toBe(fit);
  expect(arena.getAttribute('data-follow')).toBe('0');
  touch(arena, 'pointermove', 1, 140);
  touch(arena, 'pointerup', 1, 140);
  expect(inputs).toEqual([]);
  touch(arena, 'pointerdown', 3, 100);
  touch(arena, 'pointermove', 3, 140);
  expect(inputs).toEqual([['white', { round: 1, heading: 'right' }]]);
});
