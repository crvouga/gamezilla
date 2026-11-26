import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import { ActiveSpace } from './active-space';
import { useSpacePresence } from './public-use-space-presence';
import { useReopenLostHostSession } from './reopen-lost-host-session';
import { SpaceDetailInitialLoading } from './space-detail-initial-loading';
import { SpaceEndedScreen } from './space-ended-screen';
import { SpaceJoinPrompt } from './space-join-prompt';
import { SpaceManagementProvider } from './space-management-context';
import { ReachableSpace } from './space-reachability';
import { SpaceRoomProvider } from './space-room-context';
import { useSpaceRouteId } from './space-routes';
import { SpacesNavProvider } from './spaces-nav-context';
import { useSpaceByLink } from './use-space-by-link';

/** Route entry point — reads `id` from the route and dispatches to atoms. */
export function SpaceDetailScreen(): JSX.Element {
  const spaceId = useSpaceRouteId();

  return (
    <SpacesNavProvider>
      <SpaceManagementProvider spaceId={spaceId()}>
        <Show
          when={spaceId().length > 0}
          fallback={<SpaceDetailInitialLoading spaceId="" />}
        >
          <SpaceRoomProvider spaceId={spaceId()}>
            <SpaceDetailBody spaceId={spaceId()} />
          </SpaceRoomProvider>
        </Show>
      </SpaceManagementProvider>
    </SpacesNavProvider>
  );
}

function SpaceDetailBody(props: { readonly spaceId: string }): JSX.Element {
  const linkAnswered = useSpaceByLink(() => props.spaceId);
  const presence = useSpacePresence(() => props.spaceId);
  useReopenLostHostSession(() => props.spaceId);

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
        <ReachableSpace spaceId={props.spaceId}>
          <ActiveSpace spaceId={props.spaceId} />
        </ReachableSpace>
      </Match>
      <Match when={joinedEnded()}>
        <SpaceEndedScreen spaceId={props.spaceId} />
      </Match>
      <Match when={true}>
        <SpaceJoinPrompt
          spaceId={props.spaceId}
          linkAnswered={linkAnswered()}
        />
      </Match>
    </Switch>
  );
}
