import { parseTrimmedStringAttr } from '@gamezilla/client/account/devices/device-parsers';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type LinkedProviderEmailTextProps = {
  accountProviderEntityId: string;
};

/** Provider email — `null` when absent. */
export function LinkedProviderEmailText({
  accountProviderEntityId,
}: LinkedProviderEmailTextProps): ReactNode {
  const email = useQueryAttribute({
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    entityId: accountProviderEntityId,
    attributeKey: AccountProviderAttr.email,
    attributeValue: parseTrimmedStringAttr,
  });
  if (email === null) return null;
  return <Text variant="caption" selectable label={email} />;
}
