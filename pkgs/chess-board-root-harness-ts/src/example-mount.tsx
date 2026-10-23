/** @jsxImportSource solid-js */
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import type { BoardArrow, Move } from '@pkgs/chess-board-core-shared-ts/types';
import { BoardMotionProvider } from '@pkgs/chess-board-root-client-ts/board-motion-context';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from 'solid-js/web';
import type { ExampleConfig } from './example-config';
import type { RecordingAudio } from './recording-audio';
import type { RecordingMotion } from './recording-motion';

export function mountExample(args: {
  root: HTMLElement;
  session: Session;
  config: () => ExampleConfig;
  audio: RecordingAudio;
  motion: RecordingMotion;
  onMove: (move: Move) => void;
  onUserArrowsChange: (arrows: readonly BoardArrow[]) => void;
}) {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return render(
    () => (
      <I18nProvider i18n={i18n}>
        <ClockProvider
          clock={args.session.ports.clock}
          timers={args.session.ports.timers}
        >
          <ThemeProvider colorScheme="light">
            <AudioPlaybackProvider value={args.audio.port}>
              <BoardMotionProvider value={args.motion.env}>
                <ChessBoard
                  {...args.config()}
                  dataSet={{ testid: 'example-board' }}
                  onMove={args.onMove}
                  onUserArrowsChange={args.onUserArrowsChange}
                />
              </BoardMotionProvider>
            </AudioPlaybackProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ),
    args.root
  );
}
