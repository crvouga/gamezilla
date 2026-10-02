/**
 * {@link AudioPlaybackPort} that plays nothing and records which board sound
 * started, by name (`move`, `capture`, …), so the harness can show the SFX
 * sequence as text.
 */

import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds/audio-playback/ports';
import { chessSoundUrls } from '@pkgs/sounds/chess-sound-urls';
import { type Accessor, createSignal } from 'solid-js';

const IDLE: AudioPlayerStatus = {
  playing: false,
  isLoaded: true,
  duration: 1,
  currentTime: 0,
  didJustFinish: false,
};

function soundName(source: unknown): string {
  for (const [name, url] of Object.entries(chessSoundUrls)) {
    if (url === source) return name;
  }
  return String(source);
}

export type RecordingAudio = {
  readonly port: AudioPlaybackPort;
  readonly played: Accessor<readonly string[]>;
  readonly clear: () => void;
};

export function createRecordingAudio(): RecordingAudio {
  const [played, setPlayed] = createSignal<readonly string[]>([]);
  const port: AudioPlaybackPort = {
    createPlayer(source) {
      const name = soundName(source);
      const player: AudioPlayerHandle = {
        volume: 1,
        play() {
          setPlayed((prev) => [...prev, name]);
        },
        pause() {
          // Nothing is audible, so there is nothing to pause.
        },
        async seekTo() {
          // Silent players have no position to seek.
        },
        replace() {
          // The source is fixed per board sound.
        },
        remove() {
          // No resources to release.
        },
      };
      return player;
    },
    getStatus() {
      return IDLE;
    },
    subscribeStatus(_player, listener) {
      listener(IDLE);
      return () => {
        // Status never changes, so there is no listener to detach.
      };
    },
    async setAudioModeAsync() {
      // No audio session to configure.
    },
  };
  return { port, played, clear: () => setPlayed([]) };
}
