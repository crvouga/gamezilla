import { SpaceMembersGuestsBlock } from './space-members-guests-block';
import { SpaceMembersHostBlock } from './space-members-host-block';
import { Box, ScrollView } from '@gamezilla/ui';
import type { ReactNode } from 'react';

export type SpaceSessionMemberRailProps = {
  spaceId: string;
};

/** Host + guest blocks without an outer ScrollView (e.g. inside a modal). */
export function SpaceSessionMemberRailInner({
  spaceId,
}: SpaceSessionMemberRailProps): ReactNode {
  return (
    <Box sx={{ gap: 4 }}>
      <SpaceMembersHostBlock spaceId={spaceId} />
      <SpaceMembersGuestsBlock spaceId={spaceId} />
    </Box>
  );
}

export function SpaceSessionMemberRail({
  spaceId,
}: SpaceSessionMemberRailProps): ReactNode {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingVertical: 12 }}
    >
      <SpaceSessionMemberRailInner spaceId={spaceId} />
    </ScrollView>
  );
}
