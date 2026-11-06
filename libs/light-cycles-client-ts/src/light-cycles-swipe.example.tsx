import { expect, userEvent, within } from 'storybook/test';

async function swipe(arena: HTMLElement, fraction: number) {
  const bounds = arena.getBoundingClientRect();
  const x = bounds.left + bounds.width * fraction;
  const y = bounds.top + bounds.height * 0.5;
  await userEvent.pointer([
    { target: arena, keys: '[TouchA>]', coords: { clientX: x, clientY: y } },
    {
      target: arena,
      pointerName: 'TouchA',
      coords: { clientX: x, clientY: y - 30 },
    },
    { target: arena, keys: '[/TouchA]' },
  ]);
}

/** Synthetic story input has no native active pointer; the browser regression separately verifies real capture. */
export async function sharedSwipe(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const arena = canvas.getByTestId('custom-game-board-arena');
  const capture = arena.setPointerCapture;
  const release = arena.releasePointerCapture;
  arena.setPointerCapture = () => undefined;
  arena.releasePointerCapture = () => undefined;
  try {
    await swipe(arena, 0.75);
    await expect(
      canvas.getByTestId('custom-game-board-arena-rider-0')
    ).toHaveAttribute('data-heading', 'up');
    await expect(
      canvas.getByTestId('custom-game-board-arena-rider-1')
    ).toHaveAttribute('data-heading', 'left');
    await swipe(arena, 0.25);
    await expect(
      canvas.getByTestId('custom-game-board-arena-rider-1')
    ).toHaveAttribute('data-heading', 'up');
    await expect(
      canvas.getByTestId('custom-game-board-status')
    ).toHaveTextContent('You ride Comet. You ride Ember.');
  } finally {
    arena.setPointerCapture = capture;
    arena.releasePointerCapture = release;
  }
}
