import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';

export type SpaceFilter = 'all' | 'live';

/** UI row for the spaces list (from patch-db entities + resolved host label). */
export type SpaceView = {
  id: string;
  title: string;
  hostId: string;
  hostDisplayName: string;
  hostAvatarConfig: AvatarConfig | null;
  live: boolean;
};

export type SpaceMemberRow = {
  principalId: string;
  displayName: string;
  avatarConfig: AvatarConfig | null;
  role: 'host' | 'guest';
};
