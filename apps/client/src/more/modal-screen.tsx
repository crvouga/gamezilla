import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, Pressable, ScreenBase, Text } from '@gamezilla/lib/ui';
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
          <Text variant="body" label="This is a modal screen." />
          <Pressable
            onPress={() => router.dismissTo('/more')}
            sx={{ mt: 3.75, py: 3.75 }}
          >
            <Text variant="link" label="Back to Dev" />
          </Pressable>
        </Box>
      )}
    />
  );
}
