import type { AvatarConfig } from '../shared/avatar-config';
import { resolveAvatarSeed } from '../shared/avatar-config';
import { Avatar } from '@pkgs/ui';
import { memo, useMemo, type ReactNode } from 'react';

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
export const ProfileDiceBearAvatar = memo(function ProfileDiceBearAvatar({
  config,
  fallbackSeed = '',
  size,
}: ProfileDiceBearAvatarProps): ReactNode {
  const style = config.style;
  const seed = resolveAvatarSeed(config, fallbackSeed);
  const optionsJson = JSON.stringify(config.options);
  const svg = useMemo(() => {
    return profileAvatarSvg(
      {
        style,
        seed,
        options: JSON.parse(optionsJson) as AvatarConfig['options'],
      },
      size
    );
  }, [style, seed, optionsJson, size]);

  return <Avatar size={size} background="surface" svg={svg} />;
});
