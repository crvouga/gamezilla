import type { JSX } from 'solid-js';
import { RemoveSpacePersonModalView } from './remove-space-person-modal-view';
import type { SpacePerson } from './space-person-view';
import { useRemoveSpaceUser } from './use-remove-space-user';

/** Wires {@link RemoveSpacePersonModalView} to the remove-person write. */
export function RemoveSpacePersonModal(props: {
  readonly spaceId: string;
  readonly person: SpacePerson;
  readonly onClose: () => void;
}): JSX.Element {
  const remove = useRemoveSpaceUser();
  return (
    <RemoveSpacePersonModalView
      name={props.person.name}
      onClose={props.onClose}
      operation={() => remove(props.spaceId, props.person.id)}
    />
  );
}
