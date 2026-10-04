import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import { useRouter } from '@pkgs/ui-client/app-router';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { Gamepad2Icon, PlusIcon } from '@pkgs/ui-client/icons';
import { LoadingState } from '@pkgs/ui-client/loading-state';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import type { ScreenBasePrimaryAction } from '@pkgs/ui-client/screen-base-types';
import { ScreenBodyScrollView } from '@pkgs/ui-client/screen-body-scroll-view';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { SpaceCard } from './space-card';
import { openSpaceDetail } from './space-routes';
import type { SpacesNotice } from './spaces-notices';
import { SpacesAttemptNotice, SpacesHostingCount } from './spaces-notices';
import { useCheckConnection } from './use-check-connection';
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
      <ScreenBodyScrollView
        contentClass="grid items-start gap-3 pb-6"
        contentStyle={{ 'grid-template-columns': 'minmax(0, 1fr)' }}
      >
        <For each={orderedIds()}>
          {(spaceId) => <SpaceCard spaceId={spaceId} />}
        </For>
      </ScreenBodyScrollView>
    </Show>
  );
}

/**
 * Start a space, or say why not: offline (spaces need the server) or at the
 * hosting limit (an invitation to Plus). Neither is an error.
 */
function useStartSpace(): {
  readonly start: () => Promise<void>;
  readonly notice: () => SpacesNotice | null;
} {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const checkConnection = useCheckConnection();
  const engine = useSyncEngineInstance();
  const [notice, setNotice] = createSignal<SpacesNotice | null>(null);
  const start = async (): Promise<void> => {
    setNotice(null);
    // The hosting limit counts the server's live spaces. Wait until this
    // device has them, or a create the server will refuse opens anyway.
    await engine.waitForFirstSync();
    if (!(await checkConnection())) {
      setNotice({ kind: 'offline' });
      return;
    }
    const result = await createSpace();
    if (result.kind === 'limited') {
      setNotice({ kind: 'limited', decision: result.decision });
      return;
    }
    openSpaceDetail(router, result.spaceId);
  };
  return { start, notice };
}

export function SpacesScreen(): JSX.Element {
  const { t } = useLingui();
  const attempt = useStartSpace();
  const startSpace = attempt.start;
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
    <ScreenBase
      screenId="spaces"
      surface="canvas"
      breadcrumbs={[{ name: <Trans>Spaces</Trans> }]}
      primaryAction={primaryAction()}
      content={({ bodyClass }) => (
        // Lobby cards are cards already — never nest them inside an Island.
        <Show
          when={listReady()}
          fallback={
            <div class={bodyClass}>
              <LoadingState />
            </div>
          }
        >
          <div
            class={`box gap-3 ${bodyClass}`}
            data-testid={Handles.spacesListReady}
          >
            <SpacesHostingCount />
            <SpacesAttemptNotice notice={attempt.notice()} />
            <SpacesList onCreateSpace={onCreateSpace} />
          </div>
        </Show>
      )}
    />
  );
}
