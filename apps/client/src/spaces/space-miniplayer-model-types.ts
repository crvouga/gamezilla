import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';

export type SpaceMiniplayerModel =
  | { visible: false }
  | {
      visible: true;
      items: SpaceMiniplayerItemModel[];
    };

export type SpaceMiniplayerItemModel = {
  spaceId: string;
  spaceTitle: string;
  hostId: string;
  hostLabel: string;
  hostAvatarConfig: AvatarConfig | null;
  memberCount: number;
  isHost: boolean;
  onOpenSpace: () => void;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  confirmEnd: boolean;
  confirmLeave: boolean;
  onCloseEnd: () => void;
  onCloseLeave: () => void;
  onConfirmEnd: () => void;
  onConfirmLeave: () => void;
};
