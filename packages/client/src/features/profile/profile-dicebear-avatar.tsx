import { Box } from '@gamezilla/shared/ui';
import type { AvatarConfig } from '@gamezilla/shared/profile/avatar-config';
import { resolveAvatarSeed } from '@gamezilla/shared/profile/avatar-config';
import { useMemo, type ReactNode } from 'react';
import { SvgXml } from 'react-native-svg';

import { profileAvatarSvg } from './profile-dicebear';

export type ProfileDiceBearAvatarProps = {
  config: AvatarConfig;
  /** Used when `config.seed` is empty (falls back to principal id). */
  fallbackSeed: string;
  size: number;
};

/**
 * Rounds a DiceBear SVG for use in headers and profile chrome.
 */
export function ProfileDiceBearAvatar({
  config,
  fallbackSeed,
  size,
}: ProfileDiceBearAvatarProps): ReactNode {
  const resolved = useMemo(
    () => ({
      ...config,
      seed: resolveAvatarSeed(config, fallbackSeed),
    }),
    [config, fallbackSeed],
  );
  const xml = useMemo(
    () => profileAvatarSvg(resolved, size),
    [resolved, size],
  );

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
      }}
    >
      <SvgXml xml={xml} width={size} height={size} />
    </Box>
  );
}
