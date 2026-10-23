import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { createMemo, type JSX, Show } from 'solid-js';
import { SpaceShareAddPeople } from './space-share-add-people';
import { SpaceShareLinkSection } from './space-share-link-section';
import { SpaceSharePeopleList } from './space-share-people-list';
import { useSpaceCan } from './use-space-can';
import { useSpaceUserEntries } from './use-space-user-entries';

export type SpaceShareSheetProps = {
  readonly spaceId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function SpaceShareSheet(props: SpaceShareSheetProps): JSX.Element {
  const canManageMembers = useSpaceCan(
    () => props.spaceId,
    PERMISSION.spacesManageMembers
  );
  const { entries } = useSpaceUserEntries(props.spaceId);
  const listedIds = createMemo(() => new Set(entries().map((e) => e.userId)));

  return (
    <ResponsiveSurface
      visible={props.open}
      onClose={() => props.onOpenChange(false)}
      title={<Trans>Share space</Trans>}
      size="medium"
      scroll={false}
      closeDataSet={{ testid: Handles.spaceShareClose }}
    >
      <ScrollView maxHeight="lg" gap="md">
        <SpaceShareLinkSection spaceId={props.spaceId} />
        <Show when={canManageMembers()}>
          <SpaceShareAddPeople
            spaceId={props.spaceId}
            listedIds={listedIds()}
          />
        </Show>
        <SpaceSharePeopleList
          spaceId={props.spaceId}
          canManage={canManageMembers()}
        />
      </ScrollView>
    </ResponsiveSurface>
  );
}
