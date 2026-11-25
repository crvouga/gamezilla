import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from '@solidjs/web';
import { removeSpacePersonCopy } from './remove-space-person-step';
import type { SpacePerson } from './space-person-view';
import { useRemoveSpaceUser } from './use-remove-space-user';

/**
 * Remove from the People list, which closes first: the same confirm as
 * Share's Remove step, as its own dialog since nothing sits under it.
 */
export function RemoveSpacePersonModal(props: {
  readonly spaceId: string;
  readonly person: SpacePerson;
  readonly onClose: () => void;
}): JSX.Element {
  const remove = useRemoveSpaceUser();
  return (
    <MutationModal
      visible
      stackId="remove-space-person"
      {...removeSpacePersonCopy({
        get name() {
          return props.person.name;
        },
        onClose: () => props.onClose(),
        operation: () => remove(props.spaceId, props.person.id),
      })}
    />
  );
}
