import { useMyAccountId } from '@libs/auth/client/use-current-user';
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
import { useOpenSpaceIds } from './open-space/use-open-space-ids';
import { openSpaceDetail } from './space-routes';
import { useJoinableLiveSpaceIds } from './use-joinable-live-space-ids';

function sortCurrentSpacesFirst(
  spaceIds: readonly string[],
  isOpen: (spaceId: string) => boolean
): string[] {
  return [...spaceIds].sort((a, b) => {
    const aOpen = isOpen(a) ? 0 : 1;
    const bOpen = isOpen(b) ? 0 : 1;
    return aOpen - bOpen;
  });
}

function SpacesListBody() {
  const { spaceIds, isLoading } = useJoinableLiveSpaceIds();
  const { isOpen } = useOpenSpaceIds();
  const orderedIds = useMemo(
    () => sortCurrentSpacesFirst(spaceIds, isOpen),
    [spaceIds, isOpen]
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
  const accountId = useMyAccountId();
  const canCreateSpace = accountId !== null && accountId.length > 0;
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
