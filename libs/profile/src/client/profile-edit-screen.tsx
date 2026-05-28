import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

export function ProfileEditScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: <Trans>Edit profile</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <MenuRow
            title={t`Username`}
            caption={t`Display name shown in the app`}
            onPress={() => router.push('/profile/username')}
          />
          <MenuRow
            title={t`Avatar`}
            caption={t`DiceBear generated avatar`}
            onPress={() => router.push('/profile/avatar')}
          />
        </Box>
      )}
    />
  );
}
