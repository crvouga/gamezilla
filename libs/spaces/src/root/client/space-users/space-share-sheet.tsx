import { Trans } from '@lingui/solid/macro';
import { ResponsiveSurface, ScrollView } from '@pkgs/ui';
import { createMemo, type JSX, Show } from 'solid-js';

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

export function SpaceShareSheet(props: SpaceShareSheetProps): JSX.Element {
  const role = useCurrentSpaceRole(props.spaceId);
  const isHost = () => role() === 'host';
  const { entries } = useSpaceUserEntries(props.spaceId);
  const listedIds = createMemo(() => new Set(entries().map((e) => e.userId)));

  return (
    <ResponsiveSurface
      visible={props.open}
      onClose={() => props.onOpenChange(false)}
      title={<Trans>Share space</Trans>}
      size="medium"
    >
      <ScrollView frameSx={{ maxHeight: 480 }} sx={{ px: 0, gap: 3 }}>
        <SpaceShareLinkSection spaceId={props.spaceId} />
        <Show when={isHost()}>
          <SpaceShareAddPeople
            spaceId={props.spaceId}
            listedIds={listedIds()}
          />
        </Show>
        <SpaceSharePeopleList spaceId={props.spaceId} canManage={isHost()} />
      </ScrollView>
    </ResponsiveSurface>
  );
}
