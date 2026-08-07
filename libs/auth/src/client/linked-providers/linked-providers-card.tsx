import { Trans, useLingui } from '@lingui/react/macro';
import { Card, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useIsSignedIn, useMyAccountId } from '../use-current-user';
import { LinkedProvidersList } from './linked-providers-list';

/**
 * Sign-in providers body. When signed-out or anon, shows a caption hint instead
 * of the list.
 */
export function LinkedProvidersCard(): ReactNode {
  const { t } = useLingui();
  const signedIn = useIsSignedIn();
  const accountId = useMyAccountId();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Sign-in providers</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`Accounts you use to sign in.`}
      />
      {!signedIn || accountId === null ? (
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
