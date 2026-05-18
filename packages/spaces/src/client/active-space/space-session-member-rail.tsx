import { ScrollView } from '@gamezilla/ui';
import type { ReactNode } from 'react';

import { SpaceMembersList } from './space-members-list';

export type SpaceSessionMemberRailProps = {
  spaceId: string;
};

/**
 * Desktop wide-rail body: compact members list (Google Docs style) wrapped
 * in a scroll view. The mobile members modal embeds {@link SpaceMembersList}
 * directly so it can provide its own surface chrome.
 */
export function SpaceSessionMemberRail({
  spaceId,
}: SpaceSessionMemberRailProps): ReactNode {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingVertical: 8 }}
    >
      <SpaceMembersList spaceId={spaceId} />
    </ScrollView>
  );
}
