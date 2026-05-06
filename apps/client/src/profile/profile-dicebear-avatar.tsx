import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { resolveAvatarSeed } from '@gamezilla/domain/profile/avatar-config';
import { Avatar } from '@gamezilla/lib/ui';
import { useMemo, type ReactNode } from 'react';

import { profileAvatarSvg } from './profile-dicebear';

export type ProfileDiceBearAvatarProps = {
  config: AvatarConfig;
  /** Profile or host `entityId` when `config.seed` is empty (legacy / in-editor). */
  fallbackSeed?: string;
  size: number;
};

/**
 * Generates a DiceBear SVG from a stored {@link AvatarConfig} and renders
 * it inside the generic {@link Avatar} primitive.
 */
export function ProfileDiceBearAvatar({
  config,
  fallbackSeed = '',
  size,
}: ProfileDiceBearAvatarProps): ReactNode {
  const svg = useMemo(() => {
    const resolved = {
      ...config,
      seed: resolveAvatarSeed(config, fallbackSeed),
    };
    return profileAvatarSvg(resolved, size);
  }, [config, fallbackSeed, size]);

  return <Avatar size={size} background="surface" svg={svg} />;
}
