import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  PlusIcon,
  ScreenBase,
  ScrollView,
  useBreakpoint,
  type ScreenBaseAction,
  type ScreenBasePrimaryAction,
} from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { SpaceCard } from './card/space-card';
import { useSpaceActions } from './lifecycle/space-actions';
import { useSpaceMiniplayerLayoutInsets } from './miniplayer/use-space-miniplayer-layout-insets';
import { openSpaceDetail } from './space-routes';
import { useCurrentSpaceCount } from './use-current-space-count';
import { useLiveSpaceIds } from './use-live-space-ids';

function SpacesList({ bottomInset }: { bottomInset: number }) {
  const { spaceIds, isLoading } = useLiveSpaceIds();
  if (isLoading) {
    return <LoadingState size="large" />;
  }
  if (spaceIds.length === 0) {
    return (
      <EmptyState icon={Gamepad2Icon} title={<Trans>No live spaces</Trans>} />
    );
  }
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 24 + bottomInset,
        gap: 12,
      }}
    >
      {spaceIds.map((spaceId) => (
        <SpaceCard key={spaceId} spaceId={spaceId} />
      ))}
    </ScrollView>
  );
}

export type SpacesScreenProps = {
  /** Header overflow actions for user / connection / settings on mobile. */
  readonly accountActions: readonly ScreenBaseAction[];
  /** Desktop centered tab strip (top-level tab navigation). */
  readonly centerTabs?: ReactNode;
  /** Desktop trailing slot (account avatar trigger). */
  readonly headerEnd?: ReactNode;
  /** Leading slot (typically the app logo on root tabs). */
  readonly leading?: ReactNode;
};

export function SpacesScreen({
  accountActions,
  centerTabs,
  headerEnd,
  leading,
}: SpacesScreenProps) {
  const isMobile = useBreakpoint() === 'mobile';
  const { count: currentSpaceCount, isLoading: membershipLoading } =
    useCurrentSpaceCount();
  const canCreateSpace = !membershipLoading && currentSpaceCount === 0;
  const miniplayerInsets = useSpaceMiniplayerLayoutInsets();
  const router = useRouter();
  const { createSpace } = useSpaceActions();
  const { t } = useLingui();

  const primaryAction = useMemo((): ScreenBasePrimaryAction => {
    return {
      labels: {
        idle: t`New space`,
        loading: t`Creating…`,
        success: t`Created`,
        error: t`Couldn't create space`,
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
      breadcrumbs={[{ name: t`Spaces` }]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
      leading={leading}
      primaryAction={primaryAction}
      content={({ sx }) => (
        <Box style={sx}>
          <SpacesList bottomInset={miniplayerInsets.bottom} />
        </Box>
      )}
    />
  );
}
