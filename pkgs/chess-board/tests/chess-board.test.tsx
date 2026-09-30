/** @jsxImportSource solid-js */

import { describe, expect, it } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid/render';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import {
  chessBoardProbeTestId,
  chessBoardSquareTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
} from '@pkgs/chess-board-core/probe';
import { createHarnessClock } from '@pkgs/clock/harness-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { ThemeProvider } from '@pkgs/ui/theme/theme-context';
import { screen } from '@solidjs/testing-library';

import { noopAudio } from './support/board-fixture';

describe('ChessBoard', () => {
  it('mounts squares and a probe', () => {
    const { clock, timers } = createHarnessClock();
    renderWithI18n(() => (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider colorScheme="light">
          <AudioPlaybackProvider value={noopAudio()}>
            <ChessBoard size={320} animations={false} />
          </AudioPlaybackProvider>
        </ThemeProvider>
      </ClockProvider>
    ));
    expect(
      screen.getByTestId(
        chessBoardSquareTestId(DEFAULT_CHESS_BOARD_TEST_ID, 'e2')
      )
    ).toBeTruthy();
    expect(
      screen.getByTestId(chessBoardProbeTestId(DEFAULT_CHESS_BOARD_TEST_ID))
    ).toBeTruthy();
  });
});
