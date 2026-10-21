import { expect, test } from 'bun:test';
import { createOfflineAudioPlayback } from '@libs/app-root-client-ts/offline-network-audio';
import { createOfflineNetworkController } from '@libs/app-root-client-ts/offline-network-controller';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';

// regression: offline-media-fetch-leak
test('offline media never receives network sources and drops active downloads', async () => {
  const offline = createOfflineNetworkController(new KvImplInMemory());
  await offline.ready();
  const memory = createInMemoryAudioPlaybackPort();
  const audio = createOfflineAudioPlayback(offline, memory);
  const player = audio.createPlayer('/sounds/move.mp3');
  const inner = memory.players()[0]!;
  expect(memory.getSource(inner)).toBe('/sounds/move.mp3');
  offline.setOffline(true);
  expect(memory.getSource(inner)).toBeUndefined();
  player.replace({ uri: 'https://example.test/audio.mp3' });
  expect(memory.getSource(inner)).toBeUndefined();
  await expect(Promise.resolve(player.play())).rejects.toMatchObject({
    name: 'HttpNetworkError',
  });
  offline.setOffline(false);
  expect(memory.getSource(inner)).toEqual({
    uri: 'https://example.test/audio.mp3',
  });
  player.remove();
});

test('offline media can play local blobs without exposing a remote source', async () => {
  const offline = createOfflineNetworkController(new KvImplInMemory());
  const memory = createInMemoryAudioPlaybackPort();
  const audio = createOfflineAudioPlayback(offline, memory);
  const blocked = audio.createPlayer('https://example.test/audio.mp3');
  expect(memory.getSource(memory.players()[0]!)).toBeUndefined();
  const local = audio.createPlayer({ uri: 'blob:local-recording' });
  await local.play();
  expect(memory.playedSources()).toEqual([{ uri: 'blob:local-recording' }]);
  blocked.remove();
  local.remove();
});
