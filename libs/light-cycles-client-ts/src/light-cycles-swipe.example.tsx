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

/** Native bounds are read before pointer helpers can focus or scroll the arena. */
export async function sharedTouchBounds(canvasElement: HTMLElement) {
  // regression: light-cycles-unmarked-touch-halves
  const canvas = within(canvasElement);
  const arena = canvas.getByTestId('custom-game-board-arena');
  const left = canvas.getByTestId('custom-game-board-arena-touch-0');
  const right = canvas.getByTestId('custom-game-board-arena-touch-1');
  const wall = arena.querySelector('svg > rect:last-of-type')!;
  const bounds = arena.getBoundingClientRect();
  const a = left.getBoundingClientRect();
  const b = right.getBoundingClientRect();
  await expect(left).toHaveTextContent('Left: Ember');
  await expect(right).toHaveTextContent('Right: Comet');
  await expect(a.width).toBeGreaterThan(0);
  await expect(a.left).toBeGreaterThanOrEqual(bounds.left);
  await expect(b.right).toBeLessThanOrEqual(bounds.right + 1);
  await expect(
    Math.abs(a.right - (bounds.left + bounds.width / 2))
  ).toBeLessThanOrEqual(1);
  await expect(a.right).toBeLessThanOrEqual(b.left + 1);
  await expect(a.top).toBeGreaterThanOrEqual(
    wall.getBoundingClientRect().bottom - 1
  );
  const pads = canvas.queryAllByTestId(/custom-game-board-(white|black)-pad$/);
  for (const pad of pads) {
    const box = pad.getBoundingClientRect();
    await expect(box.top).toBeGreaterThanOrEqual(a.bottom);
    await expect(box.bottom).toBeLessThanOrEqual(
      canvasElement.ownerDocument.defaultView!.innerHeight
    );
  }
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
