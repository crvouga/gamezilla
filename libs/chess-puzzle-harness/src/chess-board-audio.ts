import type { ProductHarness } from '@libs/harness/harness';
import { chessSoundUrls } from '@pkgs/sounds-shared/chess-sound-urls';
import type { InMemoryAudioPlaybackPort } from '@pkgs/sounds-shared/in-memory-audio-playback-port';

/** Observe the actor's actual injected playback calls, never player status. */
export async function readPuzzleBoardSounds(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  const env = await s.harness.client(actorId);
  const audio = env.audio as InMemoryAudioPlaybackPort;
  if (typeof audio.playedSources !== 'function')
    throw new Error('Consumer sound proof requires a recording playback port');
  const names = new Map<unknown, string>(
    Object.entries(chessSoundUrls).map(([name, source]) => [source, name])
  );
  return audio.playedSources().flatMap((source) => {
    const name = names.get(source);
    return name === undefined ? [] : [name];
  });
}
