import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client/badge';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import { useOpenSpacePresence } from './use-open-space-presence';
import { useOpenSpaceSessionIds } from './use-open-space-session-ids';

/** Who this device's open spaces count, including while the app is closed. */
export function SpacePresenceProbe(): JSX.Element {
  const sessions = useOpenSpaceSessionIds();
  return (
    <For each={sessions.spaceIds()}>
      {(spaceId) => <OpenSpacePresenceMarkers spaceId={spaceId} />}
    </For>
  );
}

function OpenSpacePresenceMarkers(props: {
  readonly spaceId: string;
}): JSX.Element {
  const presence = useOpenSpacePresence(props.spaceId);
  return (
    <div class="box">
      <span
        data-testid={Handles.spaceOwnActivity}
        class="hidden"
        aria-hidden="true"
      >
        {presence.ownActivity()}
      </span>
      <For each={presence.people()}>
        {(person) => (
          <div class="box flex-row">
            <span
              data-testid={Handles.spacePerson(person.id)}
              class="hidden"
              aria-hidden="true"
            >
              1
            </span>
            <Show when={presence.idle().has(person.id)}>
              <Badge
                label={<Trans>Idle</Trans>}
                intent="neutral"
                tone="subtle"
                size="sm"
                dataSet={{ testid: Handles.spaceMemberIdle(person.id) }}
              />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
