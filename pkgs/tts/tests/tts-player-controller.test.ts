import { describe, expect, test } from 'bun:test';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import type { AudioPlaybackPort } from '@pkgs/sounds/audio-playback/ports';
import { createTtsPlayerController } from '@pkgs/tts/client/tts-player-controller';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('createTtsPlayerController', () => {
  // regression: tts-old-seek-restarts-same-url
  test('an interrupted seek cannot start speech for a later context with the same URL', async () => {
    const memory = createInMemoryAudioPlaybackPort();
    const seeks: ReturnType<typeof Promise.withResolvers<void>>[] = [];
    const audio: AudioPlaybackPort = {
      ...memory,
      createPlayer(source) {
        const target = memory.createPlayer(source);
        target.seekTo = () => {
          const pending = Promise.withResolvers<void>();
          seeks.push(pending);
          return pending.promise;
        };
        return target;
      },
    };
    const player = createTtsPlayerController({ audio });
    await player.play('same-observation.mp3');
    player.stop();
    const next = player.play('same-observation.mp3');
    seeks[0]!.resolve();
    await flush();
    expect(player.getSnapshot().isPlaying).toBe(false);
    seeks[1]!.resolve();
    await next;
    expect(player.getSnapshot().isPlaying).toBe(true);
    player.dispose();
  });

  test('play(url) loads, seeks and plays; snapshot tracks the port', async () => {
    const audio = createInMemoryAudioPlaybackPort();
    const player = createTtsPlayerController({ audio });
    const snapshots: boolean[] = [];
    player.subscribe(() => snapshots.push(player.getSnapshot().isPlaying));

    await player.play('https://cdn/a.mp3');
    await flush();

    const snap = player.getSnapshot();
    expect(snap.currentUrl).toBe('https://cdn/a.mp3');
    expect(snap.isPlaying).toBe(true);
    expect(snap.durationMs).toBe(1000);
    expect(snapshots.at(-1)).toBe(true);
    expect(audio.players()).toHaveLength(1);
  });

  test('stop() cancels a queued autoplay from an in-flight load', async () => {
    const audio = createInMemoryAudioPlaybackPort();
    const player = createTtsPlayerController({ audio });
    const p = player.play('https://cdn/b.mp3');
    player.stop();
    await p;
    await flush();
    expect(player.getSnapshot().isPlaying).toBe(false);
  });

  test('replaying the same url seeks to 0 and plays again', async () => {
    const audio = createInMemoryAudioPlaybackPort();
    const player = createTtsPlayerController({ audio });
    await player.play('https://cdn/c.mp3');
    await flush();
    player.stop();
    expect(player.getSnapshot().isPlaying).toBe(false);
    await player.play('https://cdn/c.mp3');
    await flush();
    expect(player.getSnapshot().isPlaying).toBe(true);
    expect(audio.players()).toHaveLength(1);
  });

  test('dispose removes the player and drops listeners', async () => {
    const audio = createInMemoryAudioPlaybackPort();
    const player = createTtsPlayerController({ audio });
    let notified = 0;
    player.subscribe(() => {
      notified += 1;
    });
    await player.play('https://cdn/d.mp3');
    await flush();
    const before = notified;
    player.dispose();
    player.stop();
    expect(notified).toBe(before);
  });
});
