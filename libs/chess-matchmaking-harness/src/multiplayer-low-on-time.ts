import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import type { InMemoryAudioPlaybackPort } from '@pkgs/sounds-shared/in-memory-audio-playback-port';
import { soundAssetUrls } from '@pkgs/sounds-shared/sound-urls';

/**
 * Whether a person's multiplayer screen shows one multiplayer clock as low
 * on time; null while that clock is not on their screen.
 */
export async function shownMultiplayerClockLow(
  s: ProductHarness,
  actor: string,
  side: 'white' | 'black'
): Promise<boolean | null> {
  await bringToFront(s, actor);
  const clock = (await actorUi(s, actor)).get(`multiplayer-${side}-clock`);
  if (!(await clock.isVisible())) return null;
  return (await clock.attribute('data-low')) === 'true';
}

/**
 * How many times this device has sounded the low on time warning: its
 * actual playback calls, never a player's status.
 */
export async function lowOnTimeWarningsHeard(
  s: ProductHarness,
  actor: string
): Promise<number> {
  const env = await s.harness.client(actor);
  const audio = env.audio as InMemoryAudioPlaybackPort;
  if (typeof audio.playedSources !== 'function')
    throw new Error('Sound proof requires a recording playback port');
  const warning = soundAssetUrls['gameplay.timerWarning'];
  return audio.playedSources().filter((source) => source === warning).length;
}
