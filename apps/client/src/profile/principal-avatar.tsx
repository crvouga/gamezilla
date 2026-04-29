import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { Box, IconSymbol, useTheme } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';

export type PrincipalAvatarProps = {
  avatarConfig: AvatarConfig | null;
  principalId: string;
  size: number;
  loading?: boolean;
  /**
   * Empty / loading placeholder only: frosted light plate + light person
   * glyph for vivid backgrounds (e.g. space card gradient), matching other
   * white-on-gradient chrome on that surface.
   */
  vividBackdrop?: boolean;
};

/**
 * Renders a principal’s avatar: generic user silhouette on a muted disk when
 * loading or no persisted config; otherwise the persisted DiceBear avatar.
 */
const VIVID_PLATE = 'rgba(255,255,255,0.22)';
const VIVID_GLYPH = 'rgba(255,255,255,0.92)';

export function PrincipalAvatar({
  avatarConfig,
  principalId,
  size,
  loading = false,
  vividBackdrop = false,
}: PrincipalAvatarProps): ReactNode {
  const theme = useTheme();
  if (loading || avatarConfig === null) {
    const iconSize = Math.max(12, Math.round(size * 0.48));
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: vividBackdrop ? VIVID_PLATE : theme.colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconSymbol
          name="person.fill"
          size={iconSize}
          color={vividBackdrop ? VIVID_GLYPH : theme.colors.tabIconDefault}
        />
      </Box>
    );
  }
  return (
    <ProfileDiceBearAvatar
      config={avatarConfig}
      fallbackSeed={principalId}
      size={size}
      loading={false}
    />
  );
}
