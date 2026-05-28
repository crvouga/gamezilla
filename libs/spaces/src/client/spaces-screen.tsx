import { useSpaceActions } from './lifecycle/space-actions';
import { SpaceCard } from './card/space-card';
import { useCurrentSpaceCount } from './use-current-space-count';
import { useLiveSpaceIds } from './use-live-space-ids';
import {
  Box,
  Button,
  EmptyState,
  ScreenBase,
  ScrollView,
  Text,
  useBreakpoint,
  type ScreenBaseAction,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

function SpacesList() {
  const spaceIds = useLiveSpaceIds();
  if (spaceIds.length === 0) {
    return (
      <EmptyState
        icon="house.fill"
        title={<Trans>No live spaces</Trans>}
        body={<Trans>Tap + New space above to start one.</Trans>}
      />
    );
  }
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 24,
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
  const router = useRouter();
  const { createSpace } = useSpaceActions();
  const { t } = useLingui();
  const currentSpaceCount = useCurrentSpaceCount();
  const alreadyInSpace = currentSpaceCount > 0;

  const onNewSpace = () => {
    if (alreadyInSpace) return;
    const newId = createSpace();
    router.push({ pathname: '/space/[id]', params: { id: newId } });
  };

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans> },
      ]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
      leading={leading}
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          <Button
            title={t`+ New space`}
            disabled={alreadyInSpace}
            onPress={() => void onNewSpace()}
          />
          {alreadyInSpace ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={<Trans>You’re already in a space</Trans>}
            />
          ) : null}
          <SpacesList />
        </Box>
      )}
    />
  );
}
