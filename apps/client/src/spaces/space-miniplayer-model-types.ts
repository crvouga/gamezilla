import type { SpaceMemberRow } from '@gamezilla/client/spaces/types';

export type SpaceMiniplayerModel =
  | { visible: false }
  | {
      visible: true;
      spaceTitle: string;
      hostId: string;
      hostLabel: string;
      hostAvatarConfig: SpaceMemberRow['avatarConfig'];
      membersForStack: SpaceMemberRow[];
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
