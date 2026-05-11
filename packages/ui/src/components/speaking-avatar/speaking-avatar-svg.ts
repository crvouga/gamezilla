/**
 * Generates a deterministic DiceBear SVG for the {@link SpeakingAvatar}'s
 * head graphic. Uses the {@link toon-head} style, which provides a clean, cartoon
 * human head, ensuring recognizability and friendliness regardless of seed.
 *
 * See: https://dicebear.com/styles/toon-head/
 */

import { toonHead } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';

export function speakingAvatarSvg(seed: string, size: number): string {
  // DiceBear toon-head: cartoon human head, stable style
  return createAvatar(toonHead, {
    seed,
    size,
    randomizeIds: true,
  }).toString();
}
