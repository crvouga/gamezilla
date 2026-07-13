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
            caption={t`Unique handle for search and invites`}
            onPress={() => router.push('/profile/handle')}
          />
          <MenuRow
            title={t`Avatar`}
            caption={t`Pick a fun emoji look`}
            onPress={() => router.push('/profile/avatar')}
          />
        </Box>
      )}
    />
  );
}
