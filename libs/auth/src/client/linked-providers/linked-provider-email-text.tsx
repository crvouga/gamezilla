import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import {
  AccountProviderField,
  useAccountProviderColumn,
} from '../use-account-provider-column';

export type LinkedProviderEmailTextProps = {
  accountProviderEntityId: string;
};

/** Provider email — `null` when absent. */
export function LinkedProviderEmailText({
  accountProviderEntityId,
}: LinkedProviderEmailTextProps): ReactNode {
  const email = useAccountProviderColumn(
    accountProviderEntityId,
    AccountProviderField.email
  );
  if (email === null) return null;
  return <Text variant="caption" selectable label={email} />;
}
