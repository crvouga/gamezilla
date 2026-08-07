import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { formatTimestamp } from '../device-parsers';
import {
  AccountProviderField,
  useAccountProviderColumn,
} from '../use-account-provider-column';

export type LinkedProviderConnectedAtTextProps = {
  accountProviderEntityId: string;
};

/** When the provider was linked. */
export function LinkedProviderConnectedAtText({
  accountProviderEntityId,
}: LinkedProviderConnectedAtTextProps): ReactNode {
  const linkedAt = useAccountProviderColumn(
    accountProviderEntityId,
    AccountProviderField.linkedAt
  );
  if (linkedAt === null) return null;
  return <Text variant="caption" label={formatTimestamp(linkedAt)} />;
}
