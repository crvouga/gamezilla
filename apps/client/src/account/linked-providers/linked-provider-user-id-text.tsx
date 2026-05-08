import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

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
    attributeKey: AccountProviderAttr.providerUserId.key,

    parse: AccountProviderAttr.providerUserId.parse,
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
