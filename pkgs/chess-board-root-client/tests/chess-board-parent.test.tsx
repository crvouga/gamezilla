/** @jsxImportSource solid-js */

import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client/render';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { BoardMotionProvider } from '@pkgs/chess-board-root-client/board-motion-context';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { AudioPlaybackProvider } from '@pkgs/sounds-client/solid';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { createEffect, createSignal } from 'solid-js';

import { BOARD_PX, centerOf, noopAudio } from './board-fixture';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
});

/**
 * A parent that, inside `onMove`, updates its own state and relies on its
 * own effect having run — what a real screen does (the puzzle screen records
 * the outcome that way).
 */
function mountParent() {
  const { clock, timers } = createHarnessClock();
  const [last, setLast] = createSignal<string | null>(null);
  let seenByEffect: string | null = null;
  const inOnMove: (string | null)[] = [];
  const result = renderWithI18n(() => {
    createEffect(() => {
      seenByEffect = last();
    });
    return (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider colorScheme="light">
          <AudioPlaybackProvider value={noopAudio()}>
            <BoardMotionProvider
              value={{
                animate: null,
                prefersReducedMotion: () => false,
                lowEnd: false,
                hidden: () => false,
                paintedTransform: (el) => el.style.transform,
              }}
            >
              <ChessBoard
                size={BOARD_PX}
                dataSet={{ testid: 'parent-board' }}
                onMove={(m: Move) => {
                  setLast(`${m.from}${m.to}`);
                  inOnMove.push(seenByEffect);
                }}
              />
            </BoardMotionProvider>
          </AudioPlaybackProvider>
        </ThemeProvider>
      </ClockProvider>
    );
  });
  unmount = result.unmount;
  const host = result.container.querySelector<HTMLElement>(
    '[data-testid="parent-board"]'
  );
  if (host === null) throw new Error('board did not mount');
  const rect = new DOMRect(0, 0, BOARD_PX, BOARD_PX);
  host.getBoundingClientRect = () => rect;
  const pointer = (type: string, square: Parameters<typeof centerOf>[0]) => {
    const at = centerOf(square);
    host.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: type === 'pointermove' ? -1 : 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: at.x,
        clientY: at.y,
      })
    );
  };
  return { host, pointer, inOnMove };
}

// regression: chess-board-batched-onmove — gestures were wrapped in Solid
// `batch` for one reactive flush, which also deferred the parent's effects
// inside `onMove`; the puzzle screen's offline outcome was never recorded.
describe("the parent's onMove runs with its own effects", () => {
  test('after a drag-and-drop', () => {
    const board = mountParent();
    board.pointer('pointerdown', 'e2');
    board.pointer('pointermove', 'e4');
    board.pointer('pointerup', 'e4');
    expect(board.inOnMove).toEqual(['e2e4']);
  });

  test('after a click-click move', () => {
    const board = mountParent();
    board.pointer('pointerdown', 'g1');
    board.pointer('pointerup', 'g1');
    board.pointer('pointerdown', 'f3');
    board.pointer('pointerup', 'f3');
    expect(board.inOnMove).toEqual(['g1f3']);
  });

  test('after a keyboard move', () => {
    const board = mountParent();
    const key = (k: string) =>
      board.host.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true })
      );
    // Cursor starts on a1: walk to b1, pick up, walk to c3, drop.
    key('ArrowRight');
    key('Enter');
    key('ArrowRight');
    key('ArrowUp');
    key('ArrowUp');
    key('Enter');
    expect(board.inOnMove).toEqual(['b1c3']);
  });
});
