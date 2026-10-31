import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import type { JSX } from 'solid-js';

export function ProfileEditScreen(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();

  return (
    <MenuScreen
      screenId="profile-edit"
      breadcrumbs={[
        {
          name: <Trans>Profile</Trans>,
          onClick: () => router.push('/profile'),
        },
        { name: <Trans>Edit profile</Trans> },
      ]}
    >
      <MenuList>
        <MenuRow
          title={t`Account privacy`}
          caption={t`Take an export or permanently delete your account`}
          onClick={() => router.push('/profile/privacy')}
          dataSet={{ testid: 'profile-privacy' }}
        />
        <MenuRow
          title={t`Username`}
          caption={t`Unique handle for search and invites`}
          onClick={() => router.push('/profile/handle')}
          dataSet={{ testid: Handles.profileEditUsername }}
        />
        <MenuRow
          title={t`Avatar`}
          caption={t`Pick a fun emoji look`}
          onClick={() => router.push('/profile/avatar')}
          dataSet={{ testid: Handles.profileEditAvatar }}
        />
      </MenuList>
    </MenuScreen>
  );
}
