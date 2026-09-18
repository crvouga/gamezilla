import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  EmptyState,
  Gamepad2Icon,
  PlusIcon,
  ScreenBase,
  type ScreenBasePrimaryAction,
  ScreenBodyScrollView,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { openSpaceDetail } from '../../public/space-routes';
import { useCreateSpace } from '../../use-cases/create-space/client/use-create-space';
import { useOpenSpaceSessionIds } from '../../use-cases/list-open-sessions/client/use-open-space-session-ids';
import { RecentSpacesSection } from './card/recent-spaces-section';
import { SpaceCard } from './card/space-card';
import { useJoinableLiveSpaceIds } from './use-joinable-live-space-ids';

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
        contentClass="grid items-start gap-3 pb-[24px]"
        contentStyle={{ 'grid-template-columns': 'minmax(0, 1fr)' }}
      >
        <For each={orderedIds()}>
          {(spaceId) => <SpaceCard spaceId={spaceId} />}
        </For>
      </ScreenBodyScrollView>
    </Show>
  );
}

export function SpacesScreen(): JSX.Element {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const { t } = useLingui();

  const startSpace = async (): Promise<void> => {
    await createSpace((id) => {
      openSpaceDetail(router, id);
    });
  };

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
        <div class={`box ${bodyClass}`}>
          <SpacesList onCreateSpace={onCreateSpace} />
          <RecentSpacesSection />
        </div>
      )}
    />
  );
}
