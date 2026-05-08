import { formatTimestamp } from '@gamezilla/client/account/devices/device-parsers';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
} from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

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
