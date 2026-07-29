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
import { openSpaceDetail } from './space-routes';
import { useJoinableLiveSpaceIds } from './use-joinable-live-space-ids';

function SpacesListBody() {
  const { spaceIds, isLoading } = useJoinableLiveSpaceIds();
  if (isLoading) {
    return <LoadingState size="large" />;
  }
  if (spaceIds.length === 0) {
    return (
      <EmptyState icon={Gamepad2Icon} title={<Trans>No shared spaces</Trans>} />
    );
  }
  return (
    <Box sx={{ gap: 3 }}>
      {spaceIds.map((spaceId) => (
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
