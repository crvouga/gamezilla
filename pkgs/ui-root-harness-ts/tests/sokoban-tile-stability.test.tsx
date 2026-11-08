import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { TileBoard, type TileBoardTile } from '@pkgs/ui-root-client-ts/tile-board';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const INITIAL: readonly TileBoardTile[] = [
  { terrain: 'open', marked: false, label: 'A1: floor, worker' },
  { terrain: 'open', marked: true, label: 'B1: goal' },
];

// regression: sokoban-moving-worker-replaces-every-tile
test('moving the worker updates tile descriptions without replacing the grid', () => {
  const [tiles, setTiles] = createSignal(INITIAL);
  const view = render(() => (
    <TileBoard label="Sokoban" testId="stable" columns={2} rows={1}
      tiles={tiles()} pieces={[]} onDirection={() => undefined} />
  ));
  const before = [view.getByTestId('stable-tile-0'), view.getByTestId('stable-tile-1')];
  setTiles([
    { terrain: 'open', marked: false, label: 'A1: floor' },
    { terrain: 'open', marked: true, label: 'B1: goal, worker' },
  ]);
  expect(view.getByTestId('stable-tile-0')).toBe(before[0]);
  expect(view.getByTestId('stable-tile-1')).toBe(before[1]);
  expect(before[0]?.getAttribute('aria-label')).toBe('A1: floor');
  expect(before[1]?.getAttribute('aria-label')).toBe('B1: goal, worker');
});

// regression: sokoban-static-preview-captures-navigation
test('static and disabled previews leave directional scrolling and tab order alone', () => {
  const view = render(() => (
    <TileBoard label="Preview" testId="preview" columns={2} rows={1}
      tiles={INITIAL} pieces={[]} disabled />
  ));
  const board = view.getByTestId('preview');
  expect(board.tabIndex).toBe(-1);
  expect(board.getAttribute('data-interactive')).toBe('false');
  const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  board.dispatchEvent(arrow);
  expect(arrow.defaultPrevented).toBe(false);
});

// regression: sokoban-board-loses-outside-pointer-release
test('an active swipe captures one primary pointer and releases it after steering', () => {
  const directions: string[] = [];
  const view = render(() => (
    <TileBoard label="Sokoban" testId="swipe" columns={2} rows={1}
      tiles={INITIAL} pieces={[]} onDirection={(direction) => directions.push(direction)} />
  ));
  const board = view.getByTestId('swipe');
  const captured: number[] = [];
  board.setPointerCapture = (pointer) => { captured.push(pointer); };
  board.hasPointerCapture = (pointer) => captured.includes(pointer);
  board.releasePointerCapture = (pointer) => { captured.splice(captured.indexOf(pointer), 1); };
  fireEvent.pointerDown(board, { pointerId: 7, isPrimary: true, clientX: 20, clientY: 20, button: 0 });
  expect(captured).toEqual([7]);
  fireEvent.pointerUp(board, { pointerId: 7, clientX: 140, clientY: 20 });
  expect(directions).toEqual(['right']);
  expect(captured).toEqual([]);
});
