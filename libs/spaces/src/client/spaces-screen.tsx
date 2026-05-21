import { useSpaceActions } from './lifecycle/space-actions';
import { SpaceCard } from './card/space-card';
import { useCurrentSpaceCount } from './use-current-space-count';
import { useLiveSpaceIds } from './use-live-space-ids';
import {
  Box,
  Button,
  ScreenBase,
  ScrollView,
  Text,
  useBreakpoint,
  type ScreenBaseAction,
} from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

function SpacesList() {
  const spaceIds = useLiveSpaceIds();
  if (spaceIds.length === 0) {
    return (
      <Box sx={{ py: 8, alignItems: 'center' }}>
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          label={<Trans>No live spaces. Tap + New space to start one.</Trans>}
        />
      </Box>
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
};

export function SpacesScreen({
  accountActions,
  centerTabs,
  headerEnd,
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
        {
          name: <Trans>Spaces</Trans>,
          subtitle: <Trans>Rooms to play with friends</Trans>,
        },
      ]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
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
