/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid/render';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { createSimClock } from '@pkgs/clock/sim-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import type { AudioPlaybackPort } from '@pkgs/sounds/audio-playback/ports';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { ThemeProvider } from '@pkgs/ui/theme/theme-context';
import { createSignal, Show } from 'solid-js';

import { noopAudio } from './support/board-fixture';

/** An audio port that counts players created and removed. */
function countingAudio() {
  const base = noopAudio();
  const counts = { created: 0, removed: 0 };
  const port: AudioPlaybackPort = {
    ...base,
    createPlayer(source) {
      counts.created += 1;
      const player = base.createPlayer(source);
      return {
        ...player,
        remove: () => {
          counts.removed += 1;
        },
      };
    },
  };
  return { port, counts };
}

describe('board sounds', () => {
  test('every board on a screen shares one bank of players', () => {
    const { clock, timers } = createSimClock();
    const audio = countingAudio();
    const [first, setFirst] = createSignal(true);
    const [second, setSecond] = createSignal(true);
    const [third, setThird] = createSignal(true);
    const result = renderWithI18n(() => (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider colorScheme="light">
          <AudioPlaybackProvider value={audio.port}>
            <Show when={first()}>
              <ChessBoard size={160} dataSet={{ testid: 'a' }} />
            </Show>
            <Show when={second()}>
              <ChessBoard size={160} dataSet={{ testid: 'b' }} />
            </Show>
            <Show when={third()}>
              <ChessBoard size={160} dataSet={{ testid: 'c' }} />
            </Show>
          </AudioPlaybackProvider>
        </ThemeProvider>
      </ClockProvider>
    ));
    expect(audio.counts).toEqual({ created: 7, removed: 0 });
    setFirst(false);
    setSecond(false);
    expect(audio.counts).toEqual({ created: 7, removed: 0 });
    setThird(false);
    expect(audio.counts).toEqual({ created: 7, removed: 7 });
    // A board mounted after the last one left gets a fresh bank.
    setFirst(true);
    expect(audio.counts).toEqual({ created: 14, removed: 7 });
    result.unmount();
    expect(audio.counts).toEqual({ created: 14, removed: 14 });
  });
});
