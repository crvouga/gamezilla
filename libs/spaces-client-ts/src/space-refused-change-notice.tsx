import {
  RefusedChangeCard,
  RefusedChangeNotice,
  useRefusedChanges,
} from '@libs/app-root-client-ts/refused-change-notice';
import { addSpaceUserMutation } from '@libs/spaces-shared-ts/add-space-user-mutation';
import { createSpaceMutation } from '@libs/spaces-shared-ts/create-space-mutation';
import { endSpaceMutation } from '@libs/spaces-shared-ts/end-space-mutation';
import { leaveSpaceMutation } from '@libs/spaces-shared-ts/leave-space-mutation';
import { removeSpaceUserMutation } from '@libs/spaces-shared-ts/remove-space-user-mutation';
import { renameSpaceMutation } from '@libs/spaces-shared-ts/rename-space-mutation';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Show } from 'solid-js';

/** Changes made in a space, told inside that space. */
const IN_SPACE_CHANGES: readonly string[] = [
  renameSpaceMutation.name,
  endSpaceMutation.name,
  leaveSpaceMutation.name,
  addSpaceUserMutation.name,
  removeSpaceUserMutation.name,
];

/** Changes that leave the person outside a space, told on the lobby. */
const LOBBY_CHANGES: readonly string[] = [
  createSpaceMutation.name,
  endSpaceMutation.name,
  leaveSpaceMutation.name,
];

/**
 * A refused change to this space, at the top of the space's body on the
 * body's own edge and measure: inline, under the space's bar, never over it.
 */
export function SpaceRefusedChangeNotice(): JSX.Element {
  const mode = useLayoutMode();
  const changes = useRefusedChanges(
    (name) => name !== null && IN_SPACE_CHANGES.includes(name)
  );
  return (
    <Show when={changes.refusals()[0]} keyed>
      {(refusal) => (
        <StackVertical
          width="full"
          maxWidth="prose"
          self="center"
          paddingX={mode() === 'wide' ? undefined : 'lg'}
          paddingTop="sm"
        >
          <RefusedChangeCard
            refusal={refusal}
            onDismiss={() => changes.dismiss(refusal)}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/** A refused change that left the person outside a space, on the lobby. */
export function LobbyRefusedChangeNotice(): JSX.Element {
  return <RefusedChangeNotice mutations={LOBBY_CHANGES} />;
}
