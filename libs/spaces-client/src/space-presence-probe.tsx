import { useMyId } from '@libs/auth-client/use-current-user';
import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import { SpacePresenceMarkers } from './space-presence-markers';
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
  const myId = useMyId();
  return (
    <SpacePresenceMarkers
      activity={presence.ownActivity()}
      people={presence.people().map((person) => person.id)}
      idle={[
        ...presence
          .people()
          .filter((person) => presence.idle().has(person.id))
          .map((person) => person.id),
        ...(presence.ownIdle() &&
        !presence.people().some((person) => person.id === myId())
          ? [myId()]
          : []),
      ]}
    />
  );
}
