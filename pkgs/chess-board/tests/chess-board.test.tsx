/** @jsxImportSource solid-js */
import { SmartChessBoard } from '@pkgs/chess-board/smart-chess-board';
import {
  chessBoardProbeTestId,
  chessBoardSquareTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
} from '@pkgs/chess-board-core/probe';
import { createSimClock } from '@pkgs/clock/sim-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds/audio-playback/ports';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { ThemeProvider } from '@pkgs/ui/theme/theme-context';
import { renderWithI18n } from '@pkgs/vitest-solid/render';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

const IDLE: AudioPlayerStatus = {
  playing: false,
  isLoaded: true,
  duration: 1,
  currentTime: 0,
  didJustFinish: false,
};

function noopAudio(): AudioPlaybackPort {
  return {
    createPlayer() {
      const player: AudioPlayerHandle = {
        volume: 1,
        play() {},
        pause() {},
        async seekTo() {},
        replace() {},
        remove() {},
      };
      return player;
    },
    getStatus() {
      return IDLE;
    },
    subscribeStatus(_player, listener) {
      listener(IDLE);
      return () => {};
    },
    async setAudioModeAsync() {},
  };
}

describe('SmartChessBoard', () => {
  it('mounts squares and a probe', () => {
    const { clock, timers } = createSimClock();
    renderWithI18n(() => (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider colorScheme="light">
          <AudioPlaybackProvider value={noopAudio()}>
            <SmartChessBoard size={320} animations={false} />
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
