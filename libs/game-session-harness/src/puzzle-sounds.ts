/**
 * What a solver hears of a game's puzzles: the sounds the app's audio
 * actually played on their device (its recording playback port), each as
 * the game names it (`HarnessGame.puzzleSounds`); the app's other sounds
 * are not the puzzle's.
 */

import type { ProductHarness } from '@libs/harness/harness';
import type { InMemoryAudioPlaybackPort } from '@pkgs/sounds-shared/in-memory-audio-playback-port';
import type { PuzzleSoundKind } from './harness-game';
import { harnessGameOf } from './harness-game-of';

/** Every puzzle sound `gameId`'s puzzles played on the device, oldest first. */
export async function readPuzzleSoundsPlayed(
  s: ProductHarness,
  actorId: string,
  gameId: string
): Promise<readonly PuzzleSoundKind[]> {
  const named = harnessGameOf(s, gameId).puzzleSounds ?? {};
  const env = await s.harness.client(actorId);
  const audio = env.audio as Partial<InMemoryAudioPlaybackPort>;
  if (typeof audio.playedSources !== 'function')
    throw new Error('hearing sounds needs a recording playback port');
  return audio.playedSources().flatMap((source) => {
    const kind = typeof source === 'string' ? named[source] : undefined;
    return kind === undefined ? [] : [kind];
  });
}
