import { expect, test } from 'bun:test';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';
import { recordAudioPlayback } from '@pkgs/sounds/audio-playback/recording-audio-playback-port';

test('recording delegates playback and source replacement to the actual device', async () => {
  const device = createInMemoryAudioPlaybackPort();
  const recording = recordAudioPlayback(device);
  const player = recording.createPlayer({ uri: 'first' });
  await player.play();
  const actual = device.players()[0]!;
  expect(device.getStatus(actual).playing).toBe(true);
  expect(recording.getStatus(player)).toEqual(device.getStatus(actual));
  player.replace({ uri: 'second' });
  expect(recording.getSource(player)).toEqual(device.getSource(actual));
  player.pause();
  expect(device.getStatus(actual).playing).toBe(false);
  recording.failNextMatching((source) => source === undefined);
  expect(() => recording.createPlayer()).toThrow('Audio device unavailable');
  expect(recording.failures()).toBe(1);
  expect(() => recording.createPlayer()).not.toThrow();
});
