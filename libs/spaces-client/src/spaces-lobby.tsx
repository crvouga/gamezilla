import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client/icons';
import { List } from '@pkgs/ui-root-client/list';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client/screen-body-scroll-view';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { SpaceCard } from './space-card';
import { SpacesLobbyContent } from './spaces-notices';
import { useJoinableLiveSpaceIds } from './use-joinable-live-space-ids';
import { useOpenSpaceSessionIds } from './use-open-space-session-ids';

function sortCurrentSpacesFirst(
  spaceIds: readonly string[],
  openSet: ReadonlySet<string>
): string[] {
  return [...spaceIds].sort((a, b) => {
    const aOpen = openSet.has(a) ? 0 : 1;
    const bOpen = openSet.has(b) ? 0 : 1;
    return aOpen - bOpen;
  });
}

function SpacesEmptyState(props: {
  readonly onCreateSpace: () => void;
}): JSX.Element {
  return (
    <EmptyState
      icon={Gamepad2Icon}
      title={<Trans>No spaces yet</Trans>}
      body={
        <Trans>
          Start a space to play with friends. Spaces you join show up here.
        </Trans>
      }
      action={{
        label: <Trans>Start a space</Trans>,
        onClick: props.onCreateSpace,
      }}
    />
  );
}

/**
 * The lobby: what the viewer hosts, then the spaces they can join. It has
 * answered only once both have — until then it is loading, never "No spaces
 * yet", because an empty lobby is an answer, not a guess.
 */
export function SpacesLobby(props: {
  readonly onCreateSpace: () => void;
}): JSX.Element {
  const joinable = useJoinableLiveSpaceIds();
  const open = useOpenSpaceSessionIds();
  const orderedIds = createMemo(() =>
    sortCurrentSpacesFirst(joinable.spaceIds(), new Set(open.spaceIds()))
  );

  return (
    <SpacesLobbyContent listLoading={joinable.isLoading()}>
      <Show
        when={orderedIds().length > 0}
        fallback={<SpacesEmptyState onCreateSpace={props.onCreateSpace} />}
      >
        <ScreenBodyScrollView paddingBottom="xl">
          <List>
            <For each={orderedIds()}>
              {(spaceId) => <SpaceCard spaceId={spaceId} />}
            </For>
          </List>
        </ScreenBodyScrollView>
      </Show>
    </SpacesLobbyContent>
  );
}
