/** @jsxImportSource solid-js */
/**
 * A game's puzzle board mounted alone inside the app's providers a board
 * may read (the clock, the theme, audio and the sounds preference), as the
 * platform's puzzle screens mount it, driven by a DOM driver. A suite module
 * of its own because the conformance planner loads suites without the JSX
 * transform.
 */

import type {
  PuzzleBoardMarks,
  PuzzleBoardProps,
} from '@libs/game-puzzle-client-ts/puzzle-client';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  AudioPlaybackProvider,
  SoundsPreferenceProvider,
} from '@pkgs/sounds-client-ts/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import type { SolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';

export const PUZZLE_BOARD = 'conformance-puzzle-board';
export const UNMARKED: PuzzleBoardMarks = {
  wrong: null,
  hint: null,
  solution: null,
};

export type MountedBoardProps = Partial<PuzzleBoardProps> & {
  readonly position: string;
};

/** A driver over `game`'s puzzle board, reporting its moves to `played`. */
export function puzzleBoardDriver(
  game: HarnessGame,
  props: MountedBoardProps,
  played: string[]
): SolidDomDriver {
  const part = game.client.puzzles;
  if (part === undefined) throw new Error(`${game.label} has no puzzle board`);
  const time = createHarnessClock();
  return createSolidDomDriver({
    clock: time.clock,
    pump: async () => {
      time.clock.advance(1);
      await Promise.resolve();
    },
    harness: {
      createRoot: () => () => (
        <ClockProvider clock={time.clock} timers={time.timers}>
          <ThemeProvider colorScheme="light">
            <AudioPlaybackProvider value={createInMemoryAudioPlaybackPort()}>
              <SoundsPreferenceProvider>
                <part.Board
                  testId={PUZZLE_BOARD}
                  orientation="white"
                  interactive
                  sound={false}
                  setup={null}
                  syncKey={0}
                  size={320}
                  mode="play"
                  animated={false}
                  moveMs={0}
                  marks={UNMARKED}
                  suggestions={[]}
                  onAction={(action) => played.push(action)}
                  {...props}
                />
              </SoundsPreferenceProvider>
            </AudioPlaybackProvider>
          </ThemeProvider>
        </ClockProvider>
      ),
    },
  });
}
