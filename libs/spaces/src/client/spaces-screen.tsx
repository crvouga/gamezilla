import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  PlusIcon,
  ScreenBase,
  ScreenBodyScrollView,
  type ScreenBasePrimaryAction,
} from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';

import { SpaceCard } from './card/space-card';
import { useCreateSpace } from './create-space/use-create-space';
import { useOpenSpaceSessionIds } from './open-space/use-open-space-session-ids';
import { openSpaceDetail } from './space-routes';
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

function SpacesListBody() {
  const { spaceIds, isLoading } = useJoinableLiveSpaceIds();
  const { spaceIds: openSpaceIds } = useOpenSpaceSessionIds();
  const openSet = useMemo(() => new Set(openSpaceIds), [openSpaceIds]);
  const orderedIds = useMemo(
    () => sortCurrentSpacesFirst(spaceIds, openSet),
    [spaceIds, openSet]
  );
  if (isLoading) {
    return <LoadingState size="large" />;
  }
  if (orderedIds.length === 0) {
    return (
      <EmptyState icon={Gamepad2Icon} title={<Trans>No shared spaces</Trans>} />
    );
  }
  return (
    <Box sx={{ gap: 3 }}>
      {orderedIds.map((spaceId) => (
        <SpaceCard key={spaceId} spaceId={spaceId} />
      ))}
    </Box>
  );
}

function SpacesList() {
  return (
    <Box sx={{ flex: 1, gap: 2 }}>
      <ScreenBodyScrollView
        contentContainerStyle={{
          paddingBottom: 24,
          gap: 8,
        }}
      >
        <SpacesListBody />
      </ScreenBodyScrollView>
    </Box>
  );
}

export type SpacesScreenProps = {
  readonly accountMenu?: ReactNode;
  readonly leading?: ReactNode;
};

export function SpacesScreen({ accountMenu, leading }: SpacesScreenProps) {
  const canCreateSpace = useIsSignedIn();
  const router = useRouter();
  const createSpace = useCreateSpace();
  const { t } = useLingui();

  const primaryAction = useMemo((): ScreenBasePrimaryAction => {
    return {
      labels: {
        idle: t`New space`,
        loading: t`Opening…`,
        success: t`Ready`,
        error: t`Couldn't open`,
      },
      operation: async () => {
        await createSpace((id) => {
          openSpaceDetail(router, id);
        });
      },
      successHoldMs: 0,
      icon: PlusIcon,
      disabled: !canCreateSpace,
    };
  }, [canCreateSpace, createSpace, router, t]);

  return (
    <ScreenBase
      screenId="spaces"
      breadcrumbs={[{ name: t`Spaces` }]}
      accountMenu={accountMenu}
      leading={leading}
      primaryAction={primaryAction}
      content={({ sx }) => (
        <Box style={sx}>
          <SpacesList />
        </Box>
      )}
    />
  );
}
