import { Handles } from '@libs/test-ids-shared/handles';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Text } from '@pkgs/ui-root-client/text';
import { For, type JSX } from 'solid-js';

/** Presence observations for the harness, outside the visible interface. */
export function SpacePresenceMarkers(props: {
  readonly activity: string;
  readonly people: readonly string[];
  readonly idle: readonly string[];
}): JSX.Element {
  return (
    <StackVertical hidden aria-hidden>
      <Text testId={Handles.spaceOwnActivity}>{props.activity}</Text>
      <For each={props.people}>
        {(id) => <Text testId={Handles.spacePerson(id)}>1</Text>}
      </For>
      <For each={props.idle}>
        {(id) => <Text testId={Handles.spaceMemberIdle(id)}>1</Text>}
      </For>
    </StackVertical>
  );
}
