import type { JSX } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';
import { SpacesNavProvider } from '../../public/nav/spaces-nav-context';
import { SpaceRoomProvider } from '../../public/room/space-room-context';
import { useSpaceRouteId } from '../../public/space-routes';
import { useSpacePresence } from '../../public/use-space-presence';
import { ActiveSpace } from './active-space/active-space';
import { SpaceEndedScreen } from './join-space/space-ended-screen';
import { SpaceJoinPrompt } from './join-space/space-join-prompt';
import { SpaceDetailInitialLoading } from './space-detail-initial-loading';

/** Route entry point — reads `id` from the route and dispatches to atoms. */
export function SpaceDetailScreen(): JSX.Element {
  const spaceId = useSpaceRouteId();

  return (
    <Show
      when={spaceId().length > 0}
      fallback={
        <SpacesNavProvider>
          <SpaceDetailInitialLoading spaceId="" />
        </SpacesNavProvider>
      }
    >
      <SpacesNavProvider>
        <SpaceRoomProvider spaceId={spaceId()}>
          <SpaceDetailBody spaceId={spaceId()} />
        </SpaceRoomProvider>
      </SpacesNavProvider>
    </Show>
  );
}

function SpaceDetailBody(props: { readonly spaceId: string }): JSX.Element {
  const presence = useSpacePresence(() => props.spaceId);

  const joinedEnded = (): boolean => {
    const current = presence();
    return current.status === 'join' && current.ended;
  };
  return (
    <Switch>
      <Match when={presence().status === 'loading'}>
        <SpaceDetailInitialLoading spaceId={props.spaceId} />
      </Match>
      <Match when={presence().status === 'active'}>
        <ActiveSpace spaceId={props.spaceId} />
      </Match>
      <Match when={joinedEnded()}>
        <SpaceEndedScreen spaceId={props.spaceId} />
      </Match>
      <Match when={true}>
        <SpaceJoinPrompt spaceId={props.spaceId} />
      </Match>
    </Switch>
  );
}
