import { LinkedProvidersList } from './linked-providers-list';
import { Card, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LinkedProvidersCardProps = {
  accountId: string | null;
};

/**
 * Sign-in providers body. When signed-out, shows a caption hint instead of
 * the list.
 */
export function LinkedProvidersCard({
  accountId,
}: LinkedProvidersCardProps): ReactNode {
  const { t } = useLingui();
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Sign-in providers</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`Accounts you use to sign in.`}
      />
      {accountId === null ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={t`Sign in to see your sign-in providers.`}
        />
      ) : (
        <LinkedProvidersList accountId={accountId} />
      )}
    </Card>
  );
}
