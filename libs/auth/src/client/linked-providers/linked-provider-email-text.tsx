import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '../../shared';

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
    attribute: AccountProviderAttr.email,
  });
  if (email === null) return null;
  return <Text variant="caption" selectable label={email} />;
}
