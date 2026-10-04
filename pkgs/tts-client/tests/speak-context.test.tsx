/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HttpClientProvider } from '@pkgs/http-client-client/solid';
import { ObjectStoreProvider } from '@pkgs/object-store-client/solid';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';
import { AudioPlaybackProvider } from '@pkgs/sounds-client/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared/in-memory-audio-playback-port';
import { createSpeak, TtsProvider } from '@pkgs/tts-client/solid';
import { ttsCacheKey } from '@pkgs/tts-shared/tts-cache-key';
import {
  DEFAULT_TTS_VOICE,
  ttsProviderIdForVoice,
} from '@pkgs/tts-shared/tts-voice';
import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

async function drain(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

// regression: tts-identical-input-cancels-speech
test('an unchanged observation keeps its pending speech, while a new context cancels it', async () => {
  const store = new ObjectStoreImplInMemory();
  const audio = createInMemoryAudioPlaybackPort();
  const voice = DEFAULT_TTS_VOICE;
  const text = 'Find the solution.';
  const key = await ttsCacheKey({
    providerId: ttsProviderIdForVoice(voice),
    voice,
    text,
    format: 'mp3',
  });
  await store.put(key, new Uint8Array([1]), 'audio/mpeg');
  const pending = Promise.withResolvers<string>();
  const started = Promise.withResolvers<void>();
  store.getUri = () => {
    started.resolve();
    return pending.promise;
  };
  const [args, setArgs] = createSignal({
    text,
    contextKey: 'puzzle-a',
    enabled: true,
  });
  const mounted = render(() => (
    <HttpClientProvider
      value={{
        fetch: async () => {
          throw new Error('cache must satisfy speech');
        },
      }}
    >
      <ObjectStoreProvider value={store}>
        <AudioPlaybackProvider value={audio}>
          <TtsProvider apiUrl="https://example.test">
            <Coach />
          </TtsProvider>
        </AudioPlaybackProvider>
      </ObjectStoreProvider>
    </HttpClientProvider>
  ));
  function Coach() {
    createSpeak(args);
    return null;
  }
  await started.promise;
  setArgs({ text, contextKey: 'puzzle-a', enabled: true });
  pending.resolve('first.mp3');
  await drain();
  expect(audio.players()).toHaveLength(1);
  expect(audio.getStatus(audio.players()[0]!).playing).toBe(true);
  const next = Promise.withResolvers<string>();
  const nextStarted = Promise.withResolvers<void>();
  store.getUri = () => {
    nextStarted.resolve();
    return next.promise;
  };
  setArgs({ text, contextKey: 'puzzle-b', enabled: true });
  await nextStarted.promise;
  expect(audio.getStatus(audio.players()[0]!).playing).toBe(false);
  setArgs({ text, contextKey: 'puzzle-b', enabled: false });
  next.resolve('stale.mp3');
  await drain();
  expect(audio.getStatus(audio.players()[0]!).playing).toBe(false);
  mounted.unmount();
});
