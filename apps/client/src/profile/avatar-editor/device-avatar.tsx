import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { Avatar } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

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

/** Frosted plate / glyph for use over vivid (gradient) backgrounds. */
const VIVID_PLATE = String('rgba(255,255,255,0.22)');
const VIVID_GLYPH = String('rgba(255,255,255,0.92)');

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
        icon="person.fill"
        background={vividBackdrop ? VIVID_PLATE : 'outline'}
        foreground={vividBackdrop ? VIVID_GLYPH : 'tabIconDefault'}
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
