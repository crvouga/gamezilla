import { LinkedProviderRow } from '@gamezilla/client/account/linked-providers/linked-provider-row';
import { useLinkedProviderEntityIds } from '@gamezilla/client/account/linked-providers/use-linked-provider-entity-ids';
import { Box, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LinkedProvidersListProps = {
  accountId: string;
};

/** Linked-provider rows for an account, with empty-state caption. */
export function LinkedProvidersList({
  accountId,
}: LinkedProvidersListProps): ReactNode {
  const { t } = useLingui();
  const ids = useLinkedProviderEntityIds(accountId);
  if (ids.length === 0) {
    return (
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`No OAuth provider records on file for this user.`}
      />
    );
  }
  return (
    <Box sx={{ gap: 3 }}>
      {ids.map((id) => (
        <LinkedProviderRow key={id} accountProviderEntityId={id} />
      ))}
    </Box>
  );
}
