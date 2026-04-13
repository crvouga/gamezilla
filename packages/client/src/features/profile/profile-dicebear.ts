import { lorelei } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';

/** SVG markup for a deterministic DiceBear avatar (Lorelei style). */
export function profileAvatarSvg(seed: string, size: number): string {
  return createAvatar(lorelei, { seed, size }).toString();
}
