import { ResponsiveSurface, ScrollView } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

import { useCurrentSpaceRole } from '../use-current-space-role';
import { SpaceShareAddPeople } from './space-share-add-people';
import { SpaceShareLinkSection } from './space-share-link-section';
import { SpaceSharePeopleList } from './space-share-people-list';
import { useSpaceUserEntries } from './use-space-user-entries';

export type SpaceShareSheetProps = {
  readonly spaceId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function SpaceShareSheet({
  spaceId,
  open,
  onOpenChange,
}: SpaceShareSheetProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const { entries } = useSpaceUserEntries(spaceId);
  const listedIds = useMemo(
    () => new Set(entries.map((e) => e.userId)),
    [entries]
  );

  return (
    <ResponsiveSurface
      visible={open}
      onClose={() => onOpenChange(false)}
      title={<Trans>Share space</Trans>}
      size="medium"
    >
      <ScrollView style={{ maxHeight: 480 }} sx={{ px: 0, gap: 3 }}>
        <SpaceShareLinkSection spaceId={spaceId} />
        {isHost ? (
          <SpaceShareAddPeople spaceId={spaceId} listedIds={listedIds} />
        ) : null}
        <SpaceSharePeopleList spaceId={spaceId} canManage={isHost} />
      </ScrollView>
    </ResponsiveSurface>
  );
}
