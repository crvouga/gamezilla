import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import {
  AccountProviderField,
  useAccountProviderColumn,
} from '../use-account-provider-column';

export type LinkedProviderUserIdTextProps = {
  accountProviderEntityId: string;
};

/** External provider user id. */
export function LinkedProviderUserIdText({
  accountProviderEntityId,
}: LinkedProviderUserIdTextProps): ReactNode {
  const providerUserId = useAccountProviderColumn(
    accountProviderEntityId,
    AccountProviderField.providerUserId
  );
  if (providerUserId === null) return null;
  return <Text variant="caption" selectable label={providerUserId} />;
}
