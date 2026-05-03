import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { SpaceCard } from '@gamezilla/client/spaces/space-card';
import { useSpaces } from '@gamezilla/client/spaces/use-spaces';
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

type Space = ReturnType<typeof useSpaces>['spaces'][number];

type SpacesListProps = {
  spaces: Space[];
};

function SpacesList({ spaces }: SpacesListProps) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 24,
        gap: 12,
      }}
    >
      {spaces.length === 0 ? (
        <Box sx={{ py: 8, alignItems: 'center' }}>
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={<Trans>No live spaces. Tap + New space to start one.</Trans>}
          />
        </Box>
      ) : (
        spaces.map((space) => (
          <Box key={space.id} sx={{ mb: 3 }}>
            <SpaceCard space={space} />
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
  const { spaces } = useSpaces();
  const { createSpace } = useSpaceActions();
  const { t } = useLingui();
  const theme = useTheme();

  const onNewSpace = async () => {
    const newId = await createSpace();
    if (newId) {
      router.push({ pathname: '/space/[id]', params: { id: newId } });
    }
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
            style={[
              theme.sx({
                py: 3,
                px: 4,
                borderRadius: 8,
                mb: 4,
                alignItems: 'center',
              }),
              { backgroundColor: theme.colors.tintMuted },
            ]}
          >
            <Text variant="bodyBold" label={<Trans>+ New space</Trans>} />
          </Pressable>
          <SpacesList spaces={spaces} />
        </Box>
      )}
    />
  );
}
