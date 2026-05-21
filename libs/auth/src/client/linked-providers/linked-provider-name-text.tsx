import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '../../shared';
import { providerLabel } from '../provider-parsers';

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
    attribute: AccountProviderAttr.provider,
  });
  if (provider === null) return null;
  return <Text variant="bodyBold" label={providerLabel(provider)} />;
}
