import { expect, test } from 'bun:test';
import { playSynthesized } from '@pkgs/tts-root-client/play-synthesized';
import type { TtsSynthesizeResponse } from '@pkgs/tts-root-shared/tts-types';

// regression: tts-aborted-synthesis-plays
test('an old position cannot start speaking when cancelled synthesis resolves late', async () => {
  const controller = new AbortController();
  const pending = Promise.withResolvers<TtsSynthesizeResponse>();
  const spoken: string[] = [];
  const work = playSynthesized(
    { signal: controller.signal },
    () => pending.promise,
    async (result) => {
      spoken.push(result.url);
    }
  );
  controller.abort();
  pending.resolve({
    url: 'old-position.mp3',
    hash: 'old-position',
    contentType: 'audio/mpeg',
    cached: true,
  });
  await work;
  expect(spoken).toEqual([]);
});
