import { Avatar, UserIcon } from '@pkgs/ui';
import type { ReactNode } from 'react';
import type { AvatarConfig } from '../shared/avatar-config';

import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';

export type DeviceAvatarProps = {
  avatarConfig: AvatarConfig | null;
  /** Profile or member `entityId` for legacy empty `config.seed` only. */
  seedFallback: string;
  size: number;
  /**
   * Empty placeholder only: frosted light plate + light person
   * glyph for vivid backgrounds (e.g. space card gradient), matching other
   * white-on-gradient chrome on that surface.
   */
  vividBackdrop?: boolean;
};

/**
 * Renders a profile avatar: generic user silhouette when there is no persisted
 * config (e.g. not synced); otherwise the persisted DiceBear avatar. Uses
 * `seedFallback` only when persisted config has an empty legacy seed.
 */
export function DeviceAvatar({
  avatarConfig,
  seedFallback,
  size,
  vividBackdrop = false,
}: DeviceAvatarProps): ReactNode {
  if (avatarConfig === null) {
    return (
      <Avatar
        size={size}
        icon={UserIcon}
        background={vividBackdrop ? 'onTintScrim' : 'outline'}
        foreground={vividBackdrop ? 'onPrimary' : 'tabIconDefault'}
      />
    );
  }
  return (
    <ProfileDiceBearAvatar
      config={avatarConfig}
      fallbackSeed={seedFallback}
      size={size}
    />
  );
}
