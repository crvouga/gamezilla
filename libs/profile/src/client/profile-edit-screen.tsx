import { Trans, useLingui } from '@lingui/react/macro';
import { MenuList, MenuRow, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { useRouter } from 'expo-router';

export function ProfileEditScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="profile-edit"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: <Trans>Edit profile</Trans> },
      ]}
      content={({ sx }) => (
        <MenuList style={sx}>
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
        </MenuList>
      )}
    />
  );
}
