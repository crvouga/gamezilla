import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { resolveAvatarSeed } from '@gamezilla/domain/profile/avatar-config';
import { Avatar } from '@gamezilla/lib/ui';
import { useMemo, type ReactNode } from 'react';

import { profileAvatarSvg } from './profile-dicebear';

export type ProfileDiceBearAvatarProps = {
  config: AvatarConfig;
  /** Used when `config.seed` is empty (falls back to principal id). */
  fallbackSeed: string;
  size: number;
  /**
   * When `true`, render a neutral placeholder circle instead of a
   * DiceBear SVG. Prevents a random, principal-id-seeded avatar from
   * flashing on screen before the user's persisted config is loaded.
   */
  loading?: boolean;
};

/**
 * Generates a DiceBear SVG from a stored {@link AvatarConfig} and renders
 * it inside the generic {@link Avatar} primitive.
 */
export function ProfileDiceBearAvatar({
  config,
  fallbackSeed,
  size,
  loading = false,
}: ProfileDiceBearAvatarProps): ReactNode {
  const svg = useMemo(() => {
    if (loading) return null;
    const resolved = {
      ...config,
      seed: resolveAvatarSeed(config, fallbackSeed),
    };
    return profileAvatarSvg(resolved, size);
  }, [loading, config, fallbackSeed, size]);

  return <Avatar size={size} background="surface" svg={svg} />;
}
