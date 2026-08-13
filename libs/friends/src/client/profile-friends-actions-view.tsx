import { useLingui } from '@lingui/react/macro';
import { Button, useRouter } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function ProfileFriendsActions(): ReactNode {
  const router = useRouter();
  const { t } = useLingui();

  return (
    <Button
      title={t`Find friends`}
      intent="neutral"
      variant="outline"
      flex={1}
      onPress={() => router.push('/search')}
    />
  );
}
