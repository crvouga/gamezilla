import { CreateSpaceFloatingAction } from './create-space-floating-action';
import { SpaceCard } from './card/space-card';
import { useSpaceMiniplayerLayoutInsets } from './miniplayer/use-space-miniplayer-layout-insets';
import { useCurrentSpaceCount } from './use-current-space-count';
import { useLiveSpaceIds } from './use-live-space-ids';
import {
  Box,
  EmptyState,
  ScreenBase,
  ScrollView,
  useBreakpoint,
  type ScreenBaseAction,
} from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

function SpacesList({ bottomInset }: { bottomInset: number }) {
  const spaceIds = useLiveSpaceIds();
  if (spaceIds.length === 0) {
    return (
      <EmptyState
        icon="house.fill"
        title={<Trans>No live spaces</Trans>}
        body={<Trans>Tap New space to start one.</Trans>}
      />
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
  const canCreateSpace = useCurrentSpaceCount() === 0;
  const miniplayerInsets = useSpaceMiniplayerLayoutInsets();

  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Spaces</Trans> }]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
      leading={leading}
      floatingAction={
        canCreateSpace ? <CreateSpaceFloatingAction /> : undefined
      }
      content={({ sx }) => (
        <Box
          style={{
            ...sx,
            ...(miniplayerInsets.top > 0
              ? { paddingTop: miniplayerInsets.top }
              : {}),
          }}
        >
          <SpacesList bottomInset={miniplayerInsets.bottom} />
        </Box>
      )}
    />
  );
}
