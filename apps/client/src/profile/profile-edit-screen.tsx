import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';

export function ProfileEditScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Profile', onPress: nav('/profile') },
        {
          name: 'Edit profile',
          subtitle: 'Choose what to update',
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <MenuRow
            title="Username"
            caption="Display name shown in the app"
            onPress={() => router.push('/profile/username')}
          />
          <MenuRow
            title="Avatar"
            caption="DiceBear generated avatar"
            onPress={() => router.push('/profile/avatar')}
          />
        </Box>
      )}
    />
  );
}
