import { LinkedProvidersList } from './linked-providers-list';
import { Card, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LinkedProvidersCardProps = {
  accountId: string | null;
};

/**
 * Sign-in providers card. When signed-out, shows a caption hint instead of
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
        label={t`Read-only: OAuth identities stored for your account.`}
      />
      {accountId === null ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={t`OAuth provider details are listed here once you are signed in.`}
        />
      ) : (
        <LinkedProvidersList accountId={accountId} />
      )}
    </Card>
  );
}
