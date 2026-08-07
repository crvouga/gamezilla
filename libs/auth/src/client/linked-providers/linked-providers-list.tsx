import { useLingui } from '@lingui/react/macro';
import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useLinkedProviderEntityIds } from '../use-linked-provider-entity-ids';
import { LinkedProviderRow } from './linked-provider-row';

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
        label={t`No sign-in providers yet.`}
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
