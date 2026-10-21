import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { JSX } from 'solid-js';

export function ProfileFriendsActions(): JSX.Element {
  const router = useRouter();
  const { t } = useLingui();

  return (
    <Button
      title={t`Find friends`}
      intent="neutral"
      variant="outline"
      flex={1}
      onClick={() => router.push('/search')}
    />
  );
}
