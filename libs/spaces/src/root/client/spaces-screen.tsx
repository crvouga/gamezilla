import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngineActions } from '@pkgs/sync-engine/client';
import {
  Box,
  EmptyState,
  Gamepad2Icon,
  PlusIcon,
  ScreenBase,
  type ScreenBasePrimaryAction,
  ScreenBodyLegendList,
  useRouter,
} from '@pkgs/ui-rn';
import { memo, useCallback, useMemo } from 'react';
import { openSpaceDetail } from '../../public/space-routes';
import { useCreateSpace } from '../../use-cases/create-space/client/use-create-space';
import { useOpenSpaceSessionIds } from '../../use-cases/list-open-sessions/client/use-open-space-session-ids';
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

const MemoSpaceCard = memo(function MemoSpaceCard({
  spaceId,
}: {
  spaceId: string;
}) {
  return <SpaceCard spaceId={spaceId} />;
});

function SpacesEmptyState({ onCreateSpace }: { onCreateSpace: () => void }) {
  const { t } = useLingui();
  const canCreateSpace = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  if (canCreateSpace) {
    return (
      <EmptyState
        icon={Gamepad2Icon}
        title={<Trans>No spaces yet</Trans>}
        body={
          <Trans>
            Start a space to play with friends. Spaces you join show up here.
          </Trans>
        }
        action={{ label: t`Start a space`, onPress: onCreateSpace }}
      />
    );
  }
  return (
    <EmptyState
      icon={Gamepad2Icon}
      title={<Trans>No spaces yet</Trans>}
      body={<Trans>Sign in to start a space or join one from a friend.</Trans>}
      action={{ label: t`Sign in`, onPress: openSignInModal }}
    />
  );
}

function SpacesList({ onCreateSpace }: { onCreateSpace: () => void }) {
  const { refreshQueries } = useSyncEngineActions();
  const { spaceIds } = useJoinableLiveSpaceIds();
  const { spaceIds: openSpaceIds } = useOpenSpaceSessionIds();
  const openSet = useMemo(() => new Set(openSpaceIds), [openSpaceIds]);
  const orderedIds = useMemo(
    () => sortCurrentSpacesFirst(spaceIds, openSet),
    [spaceIds, openSet]
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => <MemoSpaceCard spaceId={item} />,
    []
  );

  if (orderedIds.length === 0) {
    return <SpacesEmptyState onCreateSpace={onCreateSpace} />;
  }

  return (
    <ScreenBodyLegendList
      data={orderedIds}
      keyExtractor={(id) => id}
      estimatedItemSize={160}
      drawDistance={200}
      columns={{ compact: 1, wide: 2 }}
      onRefresh={() => refreshQueries()}
      sx={{ paddingBottom: 24, gap: 3 }}
      renderItem={renderItem}
    />
  );
}

export function SpacesScreen() {
  const canCreateSpace = useIsSignedIn();
  const router = useRouter();
  const createSpace = useCreateSpace();
  const { t } = useLingui();

  const startSpace = useCallback(async () => {
    await createSpace((id) => {
      openSpaceDetail(router, id);
    });
  }, [createSpace, router]);

  const primaryAction = useMemo((): ScreenBasePrimaryAction => {
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
      disabled: !canCreateSpace,
      testID: Handles.spaceCreate,
    };
  }, [canCreateSpace, startSpace, t]);

  const onCreateSpace = useCallback(() => {
    void startSpace();
  }, [startSpace]);

  return (
    <ScreenBase
      screenId="spaces"
      surface="canvas"
      breadcrumbs={[{ name: t`Spaces` }]}
      primaryAction={primaryAction}
      content={({ sx }) => (
        // Lobby cards are cards already — never nest them inside an Island.
        <Box sx={sx}>
          <SpacesList onCreateSpace={onCreateSpace} />
        </Box>
      )}
    />
  );
}
