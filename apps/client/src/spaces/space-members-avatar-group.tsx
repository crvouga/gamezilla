import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import { AvatarGroup, Pressable } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { SpaceMembersListModal } from './space-members-list-modal';
import type { SpaceMemberRow } from './types';
import type { MemberPresenceFlags } from './use-member-presence-flags';

export type SpaceMembersAvatarGroupProps = {
  orderedMembers: SpaceMemberRow[];
  host: SpaceMemberRow | null;
  guests: SpaceMemberRow[];
  flags: Map<string, MemberPresenceFlags>;
};

const AVATAR_SIZE = 36;
const MAX_VISIBLE = 4;
/** Theme token for avatar ring; extracted so eslint lingui does not treat as user-facing copy. */
const AVATAR_GROUP_RING = 'surface' as const;

export function SpaceMembersAvatarGroup({
  orderedMembers,
  host,
  guests,
  flags,
}: SpaceMembersAvatarGroupProps) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t`People in this space`}
      >
        <AvatarGroup
          size={AVATAR_SIZE}
          maxVisible={MAX_VISIBLE}
          ringColor={AVATAR_GROUP_RING}
        >
          {orderedMembers.map((m) => (
            <DeviceAvatar
              key={m.memberId}
              avatarConfig={m.avatarConfig}
              seedFallback={m.memberId}
              size={AVATAR_SIZE}
            />
          ))}
        </AvatarGroup>
      </Pressable>
      <SpaceMembersListModal
        visible={open}
        onClose={() => setOpen(false)}
        host={host}
        guests={guests}
        flags={flags}
      />
    </>
  );
}
