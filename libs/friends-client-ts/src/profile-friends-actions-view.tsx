import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';

/**
 * The profile's friends call to action: the one solid primary on the page,
 * under the friends count, so making a friend is the obvious next step.
 */
export function ProfileFriendsActions(): JSX.Element {
  const router = useRouter();
  const { t } = useLingui();

  return (
    <Button
      title={t`Find friends`}
      intent="primary"
      variant="solid"
      icon={UserPlusIcon}
      flex={1}
      onClick={() => router.push('/search')}
    />
  );
}
