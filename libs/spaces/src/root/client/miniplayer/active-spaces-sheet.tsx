import { Trans } from '@lingui/solid/macro';
import { ResponsiveSurface, ScrollView } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';

import { ActiveSpaceSheetRow } from './active-space-sheet-row';

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
      <ScrollView class="max-h-105" contentClass="px-0">
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
      </ScrollView>
    </ResponsiveSurface>
  );
}
