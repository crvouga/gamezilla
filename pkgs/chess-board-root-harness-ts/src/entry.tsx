// @io-wall-ok — browser contract example composition root and measurement clock.
/** @jsxImportSource solid-js */
import './styles.css';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import {
  BoardMotionProvider,
  createWallMotionEnvironment,
} from '@pkgs/chess-board-root-client-ts/board-motion-context';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createRoot, createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { ChessBoardBenchPage } from './chess-board-bench-page';
import { installMotionPreference } from './motion-preference';
import { INITIAL } from './positions';
import { createRecordingAudio } from './recording-audio';

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
const reducedMotion = installMotionPreference();
const [lowEnd, setLowEnd] = createRoot(() => createSignal(false));
function exampleMotion() {
  const native = createWallMotionEnvironment();
  return {
    ...native,
    get lowEnd() {
      return lowEnd();
    },
  };
}
function mount(container: HTMLElement, benchmark = false) {
  return render(
    () => (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={clock} timers={timers}>
          <ThemeProvider colorScheme="light">
            <AudioPlaybackProvider value={audio.port}>
              <BoardMotionProvider value={exampleMotion()}>
                <Show
                  when={benchmark}
                  fallback={
                    <ChessBoard
                      {...config()}
                      dataSet={{ testid: 'browser-board' }}
                    />
                  }
                >
                  <ChessBoardBenchPage />
                </Show>
              </BoardMotionProvider>
            </AudioPlaybackProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ),
    container
  );
}
let dispose = mount(root);

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
  benchmark() {
    dispose();
    clock.advance(1000);
    audio.clear();
    dispose = mount(root, true);
  },
  sounds: audio.played,
  configure(patch: ChessBoardProps) {
    setConfig((prev) => ({ ...prev, ...patch }));
  },
  reset(next: ChessBoardProps) {
    dispose();
    setLowEnd(false);
    reducedMotion(false);
    setConfig({
      fen: INITIAL,
      size: 320,
      sound: false,
      highlightLastMove: false,
      ...next,
      fenSyncKey: (config().fenSyncKey ?? 0) + 1,
    });
    clock.advance(1000);
    dispose = mount(root);
    host().focus();
  },
  tap,
  move(from: Square, to: Square) {
    tap(from);
    tap(to);
    freeze(0);
  },
  freeze,
  lowEndDevice: setLowEnd,
  reducedMotion,
  play() {
    for (const animation of document.getAnimations()) {
      animation.currentTime = 0;
      animation.play();
    }
  },
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
