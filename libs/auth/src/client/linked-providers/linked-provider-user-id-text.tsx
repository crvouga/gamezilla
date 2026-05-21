import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Text } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '../../shared';

export type LinkedProviderUserIdTextProps = {
  accountProviderEntityId: string;
};

/** "Provider user id: …" caption for a linked provider. */
export function LinkedProviderUserIdText({
  accountProviderEntityId,
}: LinkedProviderUserIdTextProps): ReactNode {
  const { t } = useLingui();
  const providerUserId = useQueryAttribute({
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    entityId: accountProviderEntityId,
    attribute: AccountProviderAttr.providerUserId,
  });
  if (providerUserId === null) return null;
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      selectable
      label={t`Provider user id: ${providerUserId}`}
    />
  );
}
