import { createAvatar } from '@dicebear/core';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { getStyleOrDefault } from './dicebear-styles';

function sanitizeOptions(options: Record<string, unknown>): Record<string, unknown> {
  const out = { ...options };
  delete out['seed'];
  delete out['size'];
  return out;
}

/** SVG markup for a deterministic DiceBear avatar from a stored {@link AvatarConfig}. */
export function profileAvatarSvg(config: AvatarConfig, size: number): string {
  const style = getStyleOrDefault(config.style);
  const options = sanitizeOptions(config.options);
  return createAvatar(style, {
    ...options,
    seed: config.seed,
    size,
    randomizeIds: true,
  }).toString();
}
