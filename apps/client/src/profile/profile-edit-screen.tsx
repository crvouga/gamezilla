import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  IconSymbol,
  Pressable,
  ScreenBase,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';

type EditRowProps = {
  title: string;
  caption: string;
  onPress: () => void;
};

function EditRow({ title, caption, onPress }: EditRowProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          py: 3,
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text variant="bodyBold" label={title} />
          <Text variant="caption" label={caption} />
        </Box>
        <IconSymbol
          name="chevron.right"
          size={20}
          color={theme.colors.icon}
        />
      </Box>
    </Pressable>
  );
}

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
          <EditRow
            title="Switch profile"
            caption="Create, delete, or choose which profile is active"
            onPress={() => router.push('/profile/profiles')}
          />
          <EditRow
            title="Username"
            caption="Display name shown in the app"
            onPress={() => router.push('/profile/username')}
          />
          <EditRow
            title="Avatar"
            caption="DiceBear generated avatar"
            onPress={() => router.push('/profile/avatar')}
          />
        </Box>
      )}
    />
  );
}
