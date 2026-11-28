import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { SearchArt } from '@pkgs/ui-root-client-ts/illustration';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import type { JSX } from '@solidjs/web';

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
      leading={<SearchArt />}
      onClick={() => router.push('/search')}
    />
  );
}
