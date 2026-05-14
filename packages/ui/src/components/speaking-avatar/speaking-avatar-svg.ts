/**
 * Generates a deterministic DiceBear SVG for the {@link SpeakingAvatar}'s
 * head graphic. Uses the {@link toon-head} style, which provides a clean, cartoon
 * human head, ensuring recognizability and friendliness regardless of seed.
 *
 * See: https://dicebear.com/styles/toon-head/
 */

import { funEmoji } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';

const DEFAULT_SEED = '01J9H25D949E4A51ZV2N3676V1';
const DEFAULT_AVATAR_SIZE = 80;
export const SPEAKING_AVATAR_SVG = createAvatar(funEmoji, {
  seed: DEFAULT_SEED,
  size: DEFAULT_AVATAR_SIZE,
  randomizeIds: true,
  backgroundColor: ['ffdfbf'],
  mouth: ['lilSmile'],
  eyes: ['glasses'],
  radius: 12,
  // scale: 1,
  clip: true,
}).toString();
