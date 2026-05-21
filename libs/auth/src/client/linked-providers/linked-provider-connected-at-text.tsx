import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Text } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '../../shared';
import { formatTimestamp } from '../device-parsers';

export type LinkedProviderConnectedAtTextProps = {
  accountProviderEntityId: string;
};

/** "Connected: <timestamp>" caption for a linked provider. */
export function LinkedProviderConnectedAtText({
  accountProviderEntityId,
}: LinkedProviderConnectedAtTextProps): ReactNode {
  const { t } = useLingui();
  const linkedAt = useQueryAttribute({
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    entityId: accountProviderEntityId,
    attribute: AccountProviderAttr.linkedAt,
  });
  const connectedAt = formatTimestamp(linkedAt);
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      label={t`Connected: ${connectedAt}`}
    />
  );
}
