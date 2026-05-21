import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, Pressable, ScreenBase, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

export function ModalScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        { name: 'Modal' },
      ]}
      content={({ sx }) => (
        <Box
          style={sx}
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
          }}
        >
          <Text variant="body" label={<Trans>This is a modal screen.</Trans>} />
          <Pressable
            onPress={() => router.dismissTo('/more')}
            sx={{ mt: 3.75, py: 3.75 }}
          >
            <Text variant="link" label={<Trans>Back to Dev</Trans>} />
          </Pressable>
        </Box>
      )}
    />
  );
}
