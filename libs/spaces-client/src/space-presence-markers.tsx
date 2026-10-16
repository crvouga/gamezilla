import { Handles } from '@libs/test-ids-shared/handles';
import { For, type JSX } from 'solid-js';

/** Presence observations for the harness, outside the visible interface. */
export function SpacePresenceMarkers(props: {
  readonly activity: string;
  readonly people: readonly string[];
  readonly idle: readonly string[];
}): JSX.Element {
  return (
    <div hidden class="hidden" aria-hidden="true">
      <span data-testid={Handles.spaceOwnActivity}>{props.activity}</span>
      <For each={props.people}>
        {(id) => <span data-testid={Handles.spacePerson(id)}>1</span>}
      </For>
      <For each={props.idle}>
        {(id) => <span data-testid={Handles.spaceMemberIdle(id)}>1</span>}
      </For>
    </div>
  );
}
