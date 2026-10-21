import { Trans } from '@lingui/solid/macro';
import { List } from '@pkgs/ui-root-client-ts/list';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import { ActiveSpaceSheetRow } from './active-space-sheet-row';
import type { RequestEndSpaceOptions } from './end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from './leave-space-modal-provider';

export type ActiveSpacesSheetProps = {
  spaceIds: readonly string[];
  visible: boolean;
  onClose: () => void;
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/**
 * Lists every live space the user is in. Bottom sheet on mobile, centered
 * modal on wider viewports. End/Leave requestors are injected from outside
 * the portal so modal context is not dropped.
 */
export function ActiveSpacesSheet(props: ActiveSpacesSheetProps): JSX.Element {
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>Your live spaces</Trans>}
      stackId="active-spaces-sheet"
      scroll={false}
    >
      <ScrollView maxHeight="lg">
        <List>
          <For each={props.spaceIds}>
            {(spaceId) => (
              <ActiveSpaceSheetRow
                spaceId={spaceId}
                onOpen={props.onClose}
                requestEndSpace={props.requestEndSpace}
                requestLeaveSpace={props.requestLeaveSpace}
              />
            )}
          </For>
        </List>
      </ScrollView>
    </ResponsiveSurface>
  );
}
