import { expect, test } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { createBoardKeyHandler } from '@pkgs/chess-board-root-client-ts/chess-board-keys';
import type { PointerSession } from '@pkgs/chess-board-root-shared-ts/pointer-session';

function pressOn(square: Square, key: string, cursor: Square) {
  const host = document.createElement('div');
  const button = document.createElement('button');
  button.setAttribute('data-square', square);
  host.append(button);
  document.body.append(host);
  const pressed: Square[] = [];
  const moved: Square[] = [];
  const session = {
    down: (at: Square) => pressed.push(at),
    up: (at: Square) => pressed.push(at),
  } as unknown as PointerSession;
  const onKeyDown = createBoardKeyHandler({
    host: () => host,
    orientation: () => 'white',
    session,
    // The cursor as it stood before focus moved to the pressed square.
    cursor: () => cursor,
    setCursor: (next) => moved.push(next),
    clearAnnotations: () => {},
    cancel: () => {},
  });
  host.addEventListener('keydown', onKeyDown);
  button.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
  host.remove();
  return { pressed, moved };
}

// regression: board-key-in-the-same-turn-as-focus
test('Enter acts on the square holding focus, before the cursor has followed it there', () => {
  expect(pressOn('f3', 'Enter', 'e1').pressed).toEqual(['f3', 'f3']);
});

test('an arrow key walks from the square holding focus', () => {
  expect(pressOn('f3', 'ArrowUp', 'e1').moved).toEqual(['f4']);
});
