import { afterEach, expect, test } from 'bun:test';
import { eventConstructor } from '@pkgs/bun-test-solid-client-ts/native-event';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { PaddleCourt } from '@pkgs/ui-root-client-ts/paddle-court';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import fc from 'fast-check';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

afterEach(cleanup);

function court() {
  const [enabled, setEnabled] = createSignal(true);
  const directions: number[] = [];
  const view = renderUi(() => (
    <PaddleCourt
      width={1200}
      height={800}
      controlled={['first']}
      enabled={enabled()}
      label="Pong court"
      instructionsId="pong-help"
      testId="pong"
      paddles={[]}
      ball={{ x: 600, y: 400, size: 20 }}
      onDirection={(_side, direction) => directions.push(direction)}
      onTarget={() => undefined}
      onRelease={() => undefined}
    />
  ));
  return { ...view, setEnabled, directions };
}

// regression: pong-held-key-survives-reconnect
test('Pong held input clears when connection disables the court', () => {
  const view = court();
  const arena = view.getByRole('application');
  fireEvent.keyDown(arena, { key: 'w' });
  view.setEnabled(false);
  fireEvent.keyUp(arena, { key: 'w' });
  view.setEnabled(true);
  fireEvent.keyDown(arena, { key: 's' });
  expect(view.directions).toEqual([-1, 0, 1]);
});

// regression: pong-held-key-survives-window-blur
test('Pong held input clears when the browser window loses focus', () => {
  const view = court();
  const arena = view.getByRole('application');
  fireEvent.keyDown(arena, { key: 'ArrowUp' });
  const WindowEvent = eventConstructor(window);
  window.dispatchEvent(new WindowEvent('blur'));
  fireEvent.keyDown(arena, { key: 'ArrowDown' });
  expect(view.directions).toEqual([-1, 0, 1]);
});

test('Pong held input never survives an interruption for any prior key combination', () => {
  assertProperty(
    'pong-interruption-clears-held-keys',
    fc.property(
      fc.array(fc.constantFrom('w', 's', 'ArrowUp', 'ArrowDown'), {
        minLength: 1,
        maxLength: 12,
      }),
      fc.boolean(),
      fc.boolean(),
      (keys, blur, down) => {
        const view = court();
        try {
          const arena = view.getByRole('application');
          for (const key of keys) fireEvent.keyDown(arena, { key });
          if (blur) {
            const WindowEvent = eventConstructor(window);
            window.dispatchEvent(new WindowEvent('blur'));
          } else {
            view.setEnabled(false);
            view.setEnabled(true);
          }
          expect(view.directions.at(-1)).toBe(0);
          fireEvent.keyDown(arena, { key: down ? 'ArrowDown' : 'ArrowUp' });
          expect(view.directions.at(-1)).toBe(down ? 1 : -1);
        } finally {
          cleanup();
        }
      }
    )
  );
});
