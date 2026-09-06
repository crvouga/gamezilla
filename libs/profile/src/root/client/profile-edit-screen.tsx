import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  MenuList,
  MenuRow,
  ScreenBase,
  useBreadcrumbNav,
  useRouter,
} from '@pkgs/ui';
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
      content={({ sx }) => (
        <MenuList sx={sx}>
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
