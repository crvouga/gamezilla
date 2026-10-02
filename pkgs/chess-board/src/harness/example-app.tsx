/** @jsxImportSource solid-js */
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { squareCenter } from '@pkgs/chess-board-core/geometry';
import {
  chessBoardProbeTestId,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core/probe';
import type { Square } from '@pkgs/chess-board-core/types';
import { ClockProvider } from '@pkgs/clock/solid';
import type { Session } from '@pkgs/harness';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { ThemeProvider } from '@pkgs/ui';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { BoardMotionProvider } from '../board-motion-context';
import { ChessBoard } from '../chess-board';
import type { ChessBoardProps } from '../chess-board-types';
import { INITIAL } from './positions';
import { createRecordingAudio } from './recording-audio';
import { createRecordingMotion } from './recording-motion';

function required(root: HTMLElement, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`Missing board control: ${selector}`);
  return el;
}
export type ExampleConfig = ChessBoardProps;
export function createExampleApp(session: Session) {
  const root = document.createElement('div');
  document.body.append(root);
  const [config, setConfig] = createSignal<ExampleConfig>({
    fen: INITIAL,
    size: 320,
  });
  const audio = createRecordingAudio();
  const motion = createRecordingMotion({
    clock: session.ports.clock,
    timers: session.ports.timers,
    orientation: () => config().orientation ?? 'white',
    reducedMotion: false,
    lowEnd: false,
    webAnimations: true,
  });
  const moves: string[] = [];
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ClockProvider
          clock={session.ports.clock}
          timers={session.ports.timers}
        >
          <ThemeProvider colorScheme="light">
            <AudioPlaybackProvider value={audio.port}>
              <BoardMotionProvider value={motion.env}>
                <ChessBoard
                  {...config()}
                  dataSet={{ testid: 'example-board' }}
                  onMove={(m) => moves.push(`${m.from}${m.to}`)}
                />
              </BoardMotionProvider>
            </AudioPlaybackProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ),
    root
  );
  const host = required(root, '[data-testid="example-board"]');
  // oxlint-disable-next-line solid/reactivity -- Layout is read on demand by pointer events.
  host.getBoundingClientRect = () =>
    new DOMRect(0, 0, config().size ?? 320, config().size ?? 320);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    dispose();
    root.remove();
  }
  session.onDispose(close);
  function pointer(type: string, square: Square, pointerType = 'mouse') {
    const at = squareCenter(
      square,
      config().size ?? 320,
      config().orientation ?? 'white'
    );
    host.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: at.x,
        clientY: at.y,
      })
    );
  }
  function tap(square: Square) {
    pointer('pointerdown', square);
    pointer('pointerup', square);
  }
  function key(square: Square) {
    const target = required(host, `[data-square="${square}"]`);
    target.focus();
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
    );
  }
  return {
    config,
    closed: () => closed,
    host,
    root,
    moves,
    audio,
    motion,
    close,
    pointer,
    tap,
    key,
    configure(patch: Partial<ExampleConfig>): void {
      setConfig((prev) => ({ ...prev, ...patch }));
    },
    reset(next: ExampleConfig) {
      moves.length = 0;
      setConfig({ fen: INITIAL, size: 320, ...next });
    },
    probe: () =>
      parseChessBoardProbe(
        host.querySelector(
          `[data-testid="${chessBoardProbeTestId('example-board')}"]`
        )?.textContent ?? null
      ),
    view: () => ({
      pieces: [...host.querySelectorAll<HTMLElement>('[data-piece-square]')]
        .map((el) => `${el.dataset['piece']}@${el.dataset['pieceSquare']}`)
        .sort(),
      ghost: host.textContent.includes('capture-ghost'),
      holding: [
        ...document.querySelectorAll<HTMLElement>('[data-drag-avatar]'),
      ].some((el) => el.style.display !== 'none'),
      active: motion.active(),
      sounds: audio.played(),
      moves: [...moves],
    }),
    square: (square: Square) => {
      const el = required(host, `[data-square="${square}"]`);
      return {
        label: el.getAttribute('aria-label'),
        selected: el.getAttribute('aria-pressed'),
        description: el.getAttribute('aria-label'),
      };
    },
  };
}
