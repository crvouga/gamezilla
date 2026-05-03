import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { Avatar } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';

export type DeviceAvatarProps = {
  avatarConfig: AvatarConfig | null;
  deviceId: string;
  size: number;
  /**
   * Empty placeholder only: frosted light plate + light person
   * glyph for vivid backgrounds (e.g. space card gradient), matching other
   * white-on-gradient chrome on that surface.
   */
  vividBackdrop?: boolean;
};

/** Frosted plate / glyph for use over vivid (gradient) backgrounds. */
const VIVID_PLATE = String('rgba(255,255,255,0.22)');
const VIVID_GLYPH = String('rgba(255,255,255,0.92)');

/**
 * Renders a device’s avatar: generic user silhouette on a muted disk when
 * no persisted config; otherwise the persisted DiceBear avatar.
 */
export function DeviceAvatar({
  avatarConfig,
  deviceId,
  size,
  vividBackdrop = false,
}: DeviceAvatarProps): ReactNode {
  if (avatarConfig === null) {
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
      fallbackSeed={deviceId}
      size={size}
    />
  );
}
