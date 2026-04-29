import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { Avatar } from '@gamezilla/lib/ui';
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

/** Frosted plate / glyph for use over vivid (gradient) backgrounds. */
const VIVID_PLATE = String('rgba(255,255,255,0.22)');
const VIVID_GLYPH = String('rgba(255,255,255,0.92)');

/**
 * Renders a principal’s avatar: generic user silhouette on a muted disk when
 * loading or no persisted config; otherwise the persisted DiceBear avatar.
 */
export function PrincipalAvatar({
  avatarConfig,
  principalId,
  size,
  loading = false,
  vividBackdrop = false,
}: PrincipalAvatarProps): ReactNode {
  if (loading || avatarConfig === null) {
    return (
      <Avatar
        size={size}
        icon="person.fill"
        background={vividBackdrop ? VIVID_PLATE : 'outline'}
        foreground={vividBackdrop ? VIVID_GLYPH : 'tabIconDefault'}
      />
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
