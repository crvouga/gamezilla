import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuList } from '@pkgs/ui-client/menu-list';
import { MenuRow } from '@pkgs/ui-client/menu-row';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { useBreadcrumbNav } from '@pkgs/ui-client/use-breadcrumb-nav';
import { useRouter } from '@pkgs/ui-client/app-router';
import type { JSX } from 'solid-js';

export function ProfileEditScreen(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="profile-edit"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
        { name: <Trans>Edit profile</Trans> },
      ]}
      content={({ bodyClass }) => (
        <MenuList class={bodyClass}>
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
      )}
    />
  );
}
