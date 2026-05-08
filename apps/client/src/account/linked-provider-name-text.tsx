import { providerLabel } from '@gamezilla/client/account/provider-parsers';
import { parseTrimmedStringAttr } from '@gamezilla/client/account/device-parsers';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type LinkedProviderNameTextProps = {
  accountProviderEntityId: string;
};

/** Provider name text — runs raw `provider` value through `providerLabel`. */
export function LinkedProviderNameText({
  accountProviderEntityId,
}: LinkedProviderNameTextProps): ReactNode {
  const provider = useQueryAttribute({
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    entityId: accountProviderEntityId,
    attributeKey: AccountProviderAttr.provider,
    attributeValue: parseTrimmedStringAttr,
  });
  if (provider === null) return null;
  return <Text variant="bodyBold" label={providerLabel(provider)} />;
}
