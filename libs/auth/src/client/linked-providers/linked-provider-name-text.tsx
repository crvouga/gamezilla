import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { AccountProviderField, useAccountProviderColumn } from '../use-account-provider-column';
import { providerLabel } from '../provider-parsers';

export type LinkedProviderNameTextProps = {
  accountProviderEntityId: string;
};

/** Provider name text — runs raw `provider` value through `providerLabel`. */
export function LinkedProviderNameText({
  accountProviderEntityId,
}: LinkedProviderNameTextProps): ReactNode {
  const provider = useAccountProviderColumn(accountProviderEntityId, AccountProviderField.provider);
  if (provider === null) return null;
  return <Text variant="bodyBold" label={providerLabel(provider)} />;
}
