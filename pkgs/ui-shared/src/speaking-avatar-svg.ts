/**
 * Deterministic DiceBear SVG for the {@link SpeakingAvatar} head graphic.
 * Uses the `fun-emoji` style: a clean cartoon head that reads friendly
 * regardless of seed.
 *
 * See: https://dicebear.com/styles/fun-emoji/
 */

import { funEmoji } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';

const DEFAULT_SEED = '01J9H25D949E4A51ZV2N3676V1';
const DEFAULT_AVATAR_SIZE = 80;

/** Deterministic head graphic (`seed` controls which face is generated). */
export function speakingAvatarSvg(
  seed: string = DEFAULT_SEED,
  size: number = DEFAULT_AVATAR_SIZE
): string {
  return createAvatar(funEmoji, {
    seed,
    size,
    randomizeIds: false,
    backgroundColor: ['ffdfbf'],
    mouth: ['lilSmile'],
    eyes: ['glasses'],
    radius: 12,
    clip: true,
  }).toString();
}
