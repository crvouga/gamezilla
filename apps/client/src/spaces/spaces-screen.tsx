import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { SpaceCard } from '@gamezilla/client/spaces/space-card';
import { useCurrentSpaceCount } from '@gamezilla/client/spaces/use-current-space-count';
import { useLiveSpaceIds } from '@gamezilla/client/spaces/use-live-space-ids';
import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import {
  Box,
  Pressable,
  ScreenBase,
  ScrollView,
  Text,
  useBreakpoint,
  useTheme,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

function SpacesList() {
  const spaceIds = useLiveSpaceIds();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 24,
        gap: 12,
      }}
    >
      {spaceIds.length === 0 ? (
        <Box sx={{ py: 8, alignItems: 'center' }}>
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={<Trans>No live spaces. Tap + New space to start one.</Trans>}
          />
        </Box>
      ) : (
        spaceIds.map((spaceId) => (
          <Box key={spaceId} sx={{ mb: 3 }}>
            <SpaceCard spaceId={spaceId} />
          </Box>
        ))
      )}
    </ScrollView>
  );
}

export function SpacesScreen() {
  const accountActions = useAccountActions();
  const isMobile = useBreakpoint() === 'mobile';
  const router = useRouter();
  const { createSpace } = useSpaceActions();
  const { t } = useLingui();
  const theme = useTheme();
  const currentSpaceCount = useCurrentSpaceCount();
  const alreadyInSpace = currentSpaceCount > 0;

  const onNewSpace = async () => {
    if (alreadyInSpace) return;
    const newId = await createSpace();
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
      actions={isMobile ? accountActions : []}
      content={({ sx }) => (
        <Box style={sx}>
          <Pressable
            onPress={() => void onNewSpace()}
            accessibilityRole="button"
            accessibilityLabel={t`Create new space`}
            disabled={alreadyInSpace}
            style={[
              theme.sx({
                py: 3,
                px: 4,
                borderRadius: 8,
                mb: 2,
                alignItems: 'center',
                opacity: alreadyInSpace ? 0.5 : 1,
              }),
              { backgroundColor: theme.colors.tintMuted },
            ]}
          >
            <Text variant="bodyBold" label={<Trans>+ New space</Trans>} />
          </Pressable>
          {alreadyInSpace ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', mb: 4 }}
              label={<Trans>You’re already in a space</Trans>}
            />
          ) : (
            <Box sx={{ mb: 4 }} />
          )}
          <SpacesList />
        </Box>
      )}
    />
  );
}
