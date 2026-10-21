import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { Gamepad2Icon, PlusIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import type { ScreenBasePrimaryAction } from '@pkgs/ui-root-client/screen-base-types';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client/screen-body-scroll-view';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { SpaceCard } from './space-card';
import { openSpaceDetail } from './space-routes';
import { SpacesLobbyContent } from './spaces-notices';
import { useCreateSpace } from './use-create-space';
import { useJoinableLiveSpaceIds } from './use-joinable-live-space-ids';
import { useOpenSpaceSessionIds } from './use-open-space-session-ids';
import { useSpacesListReady } from './use-spaces-list-ready';

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

function SpacesList(props: {
  readonly onCreateSpace: () => void;
}): JSX.Element {
  const joinable = useJoinableLiveSpaceIds();
  const open = useOpenSpaceSessionIds();
  const orderedIds = createMemo(() =>
    sortCurrentSpacesFirst(joinable.spaceIds(), new Set(open.spaceIds()))
  );

  return (
    <Show
      when={orderedIds().length > 0}
      fallback={<SpacesEmptyState onCreateSpace={props.onCreateSpace} />}
    >
      <ScreenBodyScrollView paddingBottom="xl">
        <div class="panel">
          <For each={orderedIds()}>
            {(spaceId) => <SpaceCard spaceId={spaceId} />}
          </For>
        </div>
      </ScreenBodyScrollView>
    </Show>
  );
}

/**
 * Start locally, or show the hosting limit's invitation to Plus.
 */
function useStartSpace(): () => Promise<void> {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const start = async (): Promise<void> => {
    const result = await createSpace();
    if (result.kind === 'limited') return;
    openSpaceDetail(router, result.spaceId);
  };
  return start;
}

export function SpacesScreen(): JSX.Element {
  const { t } = useLingui();
  const startSpace = useStartSpace();
  const listReady = useSpacesListReady();

  const primaryAction = createMemo((): ScreenBasePrimaryAction => {
    return {
      labels: {
        idle: t`New space`,
        loading: t`Opening…`,
        success: t`Ready`,
        error: t`Couldn't open`,
      },
      operation: startSpace,
      successHoldMs: 0,
      icon: PlusIcon,
      dataSet: { testid: Handles.spaceCreate },
    };
  });

  const onCreateSpace = (): void => {
    void startSpace();
  };

  return (
    <CollectionScreen
      screenId="spaces"
      breadcrumbs={[{ name: <Trans>Spaces</Trans> }]}
      primaryAction={primaryAction()}
    >
      <Show when={listReady()} fallback={<LoadingState />}>
        <SpacesLobbyContent class="box flex-1 min-h-0 gap-3">
          <SpacesList onCreateSpace={onCreateSpace} />
        </SpacesLobbyContent>
      </Show>
    </CollectionScreen>
  );
}
