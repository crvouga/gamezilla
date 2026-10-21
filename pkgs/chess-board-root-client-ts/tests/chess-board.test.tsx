/** @jsxImportSource solid-js */

import { describe, expect, it } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import {
  chessBoardProbeTestId,
  chessBoardSquareTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
} from '@pkgs/chess-board-core-shared-ts/probe';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { screen } from '@solidjs/testing-library';

import { noopAudio } from './board-fixture';

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
