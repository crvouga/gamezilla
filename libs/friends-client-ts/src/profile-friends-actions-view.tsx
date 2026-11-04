import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import type { JSX } from 'solid-js';

const ROW_ICON_SIZE = 20;

/**
 * The profile's way to make a friend: a row under the friends count, in the
 * same panel, so it is always one tap away without outweighing who the
 * person is.
 */
export function ProfileFriendsActions(): JSX.Element {
  const router = useRouter();
  const { t } = useLingui();

  return (
    <MenuRow
      title={t`Find friends`}
      caption={t`Search by username`}
      leading={<UserPlusIcon size={ROW_ICON_SIZE} color="tint" />}
      onClick={() => router.push('/search')}
    />
  );
}
