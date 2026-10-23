/** @jsxImportSource solid-js */
/**
 * A mounted {@link ChessBoard} driven by raw pointer events, for what the
 * page-object suite cannot see: the individual events of one gesture (a
 * second finger, a chorded button, Windows' late `contextmenu`) and exactly
 * which DOM writes each event causes.
 */

import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import type { ChessBoardLayer } from '@pkgs/chess-board-core-shared-ts/probe';
import {
  chessBoardLayerTestId,
  parseChessBoardPaint,
} from '@pkgs/chess-board-core-shared-ts/probe';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { BoardMotionProvider } from '@pkgs/chess-board-root-client-ts/board-motion-context';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import type { BoardMotionEnvironment } from '@pkgs/chess-board-root-shared-ts/board-motion';
import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds-shared-ts/ports';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSignal } from 'solid-js';

export const BOARD_PX = 320;
const CELL = BOARD_PX / 8;
const TEST_ID = 'fixture-board';

const IDLE: AudioPlayerStatus = {
  playing: false,
  isLoaded: true,
  duration: 1,
  currentTime: 0,
  didJustFinish: false,
};

/** Accepts a call and does nothing (silent audio, inert handles). */
const ignore = (): void => undefined;
const ignoreAsync = (): Promise<void> => Promise.resolve();

export function noopAudio(): AudioPlaybackPort {
  return {
    createPlayer() {
      const player: AudioPlayerHandle = {
        volume: 1,
        play: ignore,
        pause: ignore,
        seekTo: ignoreAsync,
        replace: ignore,
        remove: ignore,
      };
      return player;
    },
    getStatus() {
      return IDLE;
    },
    subscribeStatus(_player, listener) {
      listener(IDLE);
      return ignore;
    },
    setAudioModeAsync: ignoreAsync,
  };
}

/** Slides run instantly-finishing; only their existence matters here. */
function staticMotion(): BoardMotionEnvironment {
  return {
    animate: () => ({ cancel: ignore, onFinish: ignore }),
    prefersReducedMotion: () => false,
    lowEnd: false,
    hidden: () => false,
    paintedTransform: (el) => el.style.transform,
  };
}

export type PointerInit = {
  readonly square?: Square;
  /** Board-local pixel point (overrides `square`). */
  readonly at?: { readonly x: number; readonly y: number };
  readonly button?: number;
  readonly buttons?: number;
  readonly pointerId?: number;
  readonly pointerType?: 'mouse' | 'touch' | 'pen';
};

/** Board-local center of `square` (white at the bottom). */
export function centerOf(square: Square): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return { x: (file + 0.5) * CELL, y: (7.5 - rank) * CELL };
}

export function mountBoard(props: Partial<ChessBoardProps> = {}) {
  const { clock, timers } = createHarnessClock();
  const [orientation, setOrientation] = createSignal<'white' | 'black'>(
    props.orientation ?? 'white'
  );
  const moves: string[] = [];
  const result = renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <AudioPlaybackProvider value={noopAudio()}>
          <BoardMotionProvider value={staticMotion()}>
            <ChessBoard
              {...props}
              size={BOARD_PX}
              orientation={orientation()}
              dataSet={{ testid: TEST_ID }}
              onMove={(m) => moves.push(`${m.from}${m.to}`)}
            />
          </BoardMotionProvider>
        </AudioPlaybackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  const host = result.container.querySelector<HTMLElement>(
    `[data-testid="${TEST_ID}"]`
  );
  if (host === null) throw new Error('board did not mount');
  const rect = new DOMRect(0, 0, BOARD_PX, BOARD_PX);
  host.getBoundingClientRect = () => rect;

  const pointer = (type: string, init: PointerInit): PointerEvent => {
    const at = init.at ?? centerOf(init.square ?? 'a1');
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: init.pointerId ?? 1,
      pointerType: init.pointerType ?? 'mouse',
      button: init.button ?? (type === 'pointermove' ? -1 : 0),
      buttons: init.buttons ?? (type === 'pointerup' ? 0 : 1),
      clientX: at.x,
      clientY: at.y,
    });
    host.dispatchEvent(event);
    return event;
  };

  return {
    host,
    moves,
    setOrientation,
    unmount: result.unmount,
    down: (init: PointerInit) => pointer('pointerdown', init),
    move: (init: PointerInit) => pointer('pointermove', init),
    up: (init: PointerInit) => pointer('pointerup', init),
    contextMenu: (square: Square) => {
      const at = centerOf(square);
      host.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: at.x,
          clientY: at.y,
        })
      );
    },
    /** The dragged-piece avatar (throws before the first pick-up). */
    avatar: (): HTMLElement => {
      const el = document.querySelector<HTMLElement>('[data-drag-avatar]');
      if (el === null) throw new Error('no drag avatar');
      return el;
    },
    /** The piece element standing on `square` (throws when empty). */
    piece: (square: Square): HTMLElement => {
      const el = host.querySelector<HTMLElement>(
        `[data-piece-square="${square}"]`
      );
      if (el === null) throw new Error(`no piece on ${square}`);
      return el;
    },
    layer: (layer: ChessBoardLayer): readonly string[] => {
      const node = host.querySelector(
        `[data-testid="${chessBoardLayerTestId(TEST_ID, layer)}"]`
      );
      return parseChessBoardPaint(node?.textContent ?? '');
    },
  };
}

export type MountedBoard = ReturnType<typeof mountBoard>;

/** Every DOM mutation (attributes, nodes, text) inside `root` during `run`. */
export function mutationsDuring(
  root: Node,
  run: () => void
): readonly MutationRecord[] {
  const observer = new MutationObserver(ignore);
  observer.observe(root, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true,
  });
  run();
  const records = observer.takeRecords();
  observer.disconnect();
  return records;
}
