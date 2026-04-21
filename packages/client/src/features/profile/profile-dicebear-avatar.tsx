import { Box, useTheme } from '@gamezilla/shared/ui';
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
  /**
   * When `true`, render a neutral placeholder circle instead of a
   * DiceBear SVG. Prevents a random, principal-id-seeded avatar from
   * flashing on screen before the user's persisted config is loaded.
   */
  loading?: boolean;
};

/**
 * Rounds a DiceBear SVG for use in headers and profile chrome.
 */
export function ProfileDiceBearAvatar({
  config,
  fallbackSeed,
  size,
  loading = false,
}: ProfileDiceBearAvatarProps): ReactNode {
  const theme = useTheme();
  const resolved = useMemo(
    () => ({
      ...config,
      seed: resolveAvatarSeed(config, fallbackSeed),
    }),
    [config, fallbackSeed],
  );
  const xml = useMemo(
    () => (loading ? null : profileAvatarSvg(resolved, size)),
    [loading, resolved, size],
  );

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
      }}
      style={loading ? { backgroundColor: theme.colors.surface } : undefined}
    >
      {xml !== null ? <SvgXml xml={xml} width={size} height={size} /> : null}
    </Box>
  );
}
