// @io-wall-ok — browser contract example composition root and measurement clock.
/** @jsxImportSource solid-js */
import './styles.css';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import type { Square } from '@pkgs/chess-board-core/types';
import { createHarnessClock } from '@pkgs/clock';
import { ClockProvider } from '@pkgs/clock/solid';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { ThemeProvider } from '@pkgs/ui';
import { createRoot, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { ChessBoard } from '../../chess-board';
import type { ChessBoardProps } from '../../chess-board-types';
import { INITIAL } from '../positions';
import { createRecordingAudio } from '../recording-audio';

const [config, setConfig] = createRoot(() =>
  createSignal<ChessBoardProps>({
    fen: INITIAL,
    size: 320,
    sound: false,
    highlightLastMove: false,
  })
);
const { clock, timers } = createHarnessClock();
const audio = createRecordingAudio();
const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
const root = document.getElementById('example');
if (root === null) throw new Error('Missing example host');
render(
  () => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider colorScheme="light">
          <AudioPlaybackProvider value={audio.port}>
            <ChessBoard {...config()} dataSet={{ testid: 'browser-board' }} />
          </AudioPlaybackProvider>
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ),
  root
);

function host(): HTMLElement {
  const board = document.querySelector<HTMLElement>(
    '[data-testid="browser-board"]'
  );
  if (board === null) throw new Error('Board did not mount');
  return board;
}
function tap(square: Square): void {
  const button = host().querySelector<HTMLElement>(`[data-square="${square}"]`);
  if (button === null) throw new Error(`Missing square ${square}`);
  const box = button.getBoundingClientRect();
  for (const type of ['pointerdown', 'pointerup'])
    host().dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      })
    );
}
/** Freeze native compositor animations on virtual time, before a paint. */
function freeze(ms: number): void {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = ms;
  }
}
const api = {
  configure(patch: ChessBoardProps) {
    setConfig((prev) => ({ ...prev, ...patch }));
  },
  reset(next: ChessBoardProps) {
    document.getAnimations().forEach((animation) => animation.cancel());
    setConfig({
      fen: INITIAL,
      size: 320,
      sound: false,
      highlightLastMove: false,
      ...next,
      fenSyncKey: (config().fenSyncKey ?? 0) + 1,
    });
    clock.advance(1000);
    host().focus();
  },
  tap,
  move(from: Square, to: Square) {
    tap(from);
    tap(to);
    freeze(0);
    host().focus();
  },
  freeze,
  advance: (ms: number) => clock.advance(ms),
  parent(width: number, scale = 1) {
    root.style.width = `${width}px`;
    root.style.transform = `scale(${scale})`;
  },
  now: () => performance.now(),
  paint: () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
};
declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- DOM Window augmentation requires interface merging.
  interface Window {
    boardExample: typeof api;
    boardExampleLoaded: () => void;
    boardExampleReady: Promise<void>;
  }
}
window.boardExample = api;
window.boardExampleLoaded();
export type BrowserExample = typeof api;
