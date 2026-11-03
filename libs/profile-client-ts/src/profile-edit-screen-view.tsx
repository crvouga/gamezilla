import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import type { JSX } from 'solid-js';

export type ProfileEditScreenViewProps = {
  readonly onOpenPrivacy: () => void;
  readonly onOpenUsername: () => void;
  readonly onOpenAvatar: () => void;
};

/**
 * `/profile/edit`, presentational: the menu of what a person can change
 * about their profile. `ProfileEditScreen` routes each row.
 */
export function ProfileEditScreenView(
  props: ProfileEditScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuScreen
      screenId="profile-edit"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Edit profile</Trans> },
      ]}
    >
      <MenuList>
        <MenuRow
          title={t`Account privacy`}
          caption={t`Take an export or permanently delete your account`}
          onClick={() => props.onOpenPrivacy()}
          dataSet={{ testid: 'profile-privacy' }}
        />
        <MenuRow
          title={t`Username`}
          caption={t`Unique handle for search and invites`}
          onClick={() => props.onOpenUsername()}
          dataSet={{ testid: Handles.profileEditUsername }}
        />
        <MenuRow
          title={t`Avatar`}
          caption={t`Pick a fun emoji look`}
          onClick={() => props.onOpenAvatar()}
          dataSet={{ testid: Handles.profileEditAvatar }}
        />
      </MenuList>
    </MenuScreen>
  );
}
