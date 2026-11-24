import {
  RefusedChangeCard,
  RefusedChangeNotice,
  useRefusedChanges,
} from '@libs/app-env-client-ts/refused-change-notice';
import { addSpaceUserMutation } from '@libs/spaces-shared-ts/add-space-user-mutation';
import { createSpaceMutation } from '@libs/spaces-shared-ts/create-space-mutation';
import { endSpaceMutation } from '@libs/spaces-shared-ts/end-space-mutation';
import { leaveSpaceMutation } from '@libs/spaces-shared-ts/leave-space-mutation';
import { removeSpaceUserMutation } from '@libs/spaces-shared-ts/remove-space-user-mutation';
import { renameSpaceMutation } from '@libs/spaces-shared-ts/rename-space-mutation';
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
 * A refused change to this space, with its dismiss: the space's shell
 * floats it in its alerts (`ToastStack`), never a row in the body.
 */
export function SpaceRefusedChangeNotice(): JSX.Element {
  const changes = useRefusedChanges(
    (name) => name !== null && IN_SPACE_CHANGES.includes(name)
  );
  return (
    <Show when={changes.refusals()[0]} keyed>
      {(refusal) => (
        <RefusedChangeCard
          refusal={refusal}
          onDismiss={() => changes.dismiss(refusal)}
        />
      )}
    </Show>
  );
}

/** A refused change that left the person outside a space, on the lobby. */
export function LobbyRefusedChangeNotice(): JSX.Element {
  return <RefusedChangeNotice mutations={LOBBY_CHANGES} />;
}
