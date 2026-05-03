import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';

/** UI row for the spaces list (from patch-db entities + resolved host label). Live only. */
export type SpaceView = {
  id: string;
  /** Display title: user-set name, or `${hostDisplayName}'s space` when unset. */
  title: string;
  /** User-set name, or null when the host has not chosen one. */
  customTitle: string | null;
  hostId: string;
  hostDisplayName: string;
  hostAvatarConfig: AvatarConfig | null;
};

export type SpaceMemberRow = {
  deviceId: string;
  displayName: string;
  avatarConfig: AvatarConfig | null;
  role: 'host' | 'guest';
};
