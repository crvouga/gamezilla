/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import {
  AudioPlaybackProvider,
  createAudioPlayer,
  createAudioPlayerStatus,
  SoundEngineProvider,
  SoundsPreferenceProvider,
  useSoundEngine,
  useSoundsPreference,
} from '@pkgs/sounds-client/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared/in-memory-audio-playback-port';
import { resolveWebAudioSource } from '@pkgs/sounds-shared/web-audio-playback-port';
import { render, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

function Shell(props: { readonly children: JSX.Element }): JSX.Element {
  const { clock, timers } = createHarnessClock();
  return (
    <ClockProvider clock={clock} timers={timers}>
      {props.children}
    </ClockProvider>
  );
}

describe('sounds solid bindings', () => {
  test('createAudioPlayerStatus reflects port status changes', () => {
    const port = createInMemoryAudioPlaybackPort();
    function Probe() {
      const player = createAudioPlayer('sfx.mp3');
      const status = createAudioPlayerStatus(player);
      return (
        <button type="button" onClick={() => void player.play()}>
          {status().playing ? 'playing' : 'paused'}
        </button>
      );
    }
    const { unmount } = render(() => (
      <AudioPlaybackProvider value={port}>
        <Probe />
      </AudioPlaybackProvider>
    ));
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('paused');
    button.click();
    expect(button).toHaveTextContent('playing');
    unmount();
    const [first] = port.players();
    expect(first).toBeDefined();
    if (first !== undefined) expect(port.getStatus(first).isLoaded).toBe(false);
  });

  test('sound engine honours the mute preference', () => {
    const port = createInMemoryAudioPlaybackPort();
    function Controls() {
      const prefs = useSoundsPreference();
      const engine = useSoundEngine();
      return (
        <>
          <button
            type="button"
            onClick={() => engine.play(engine.Sounds.navigation.click)}
          >
            play
          </button>
          <button type="button" onClick={() => prefs.setMuted(true)}>
            mute
          </button>
        </>
      );
    }
    render(() => (
      <Shell>
        <AudioPlaybackProvider value={port}>
          <SoundsPreferenceProvider>
            <SoundEngineProvider>
              <Controls />
            </SoundEngineProvider>
          </SoundsPreferenceProvider>
        </AudioPlaybackProvider>
      </Shell>
    ));
    const play = screen.getByRole('button', { name: 'play' });
    const mute = screen.getByRole('button', { name: 'mute' });
    play.click();
    const playersBefore = port.players().length;
    expect(playersBefore).toBeGreaterThan(0);
    mute.click();
    // Muted engine never creates players for new plays.
    const created = port.players().length;
    play.click();
    expect(port.players().length).toBe(created);
  });
});

describe('resolveWebAudioSource', () => {
  test('accepts strings, URLs and { uri } records', () => {
    expect(resolveWebAudioSource('a.mp3')).toBe('a.mp3');
    expect(resolveWebAudioSource(new URL('https://x/y.mp3'))).toBe(
      'https://x/y.mp3'
    );
    expect(resolveWebAudioSource({ uri: 'b.mp3' })).toBe('b.mp3');
    expect(resolveWebAudioSource(42)).toBeNull();
  });
});
