import { LinkedProviderConnectedAtText } from '@gamezilla/client/account/linked-providers/linked-provider-connected-at-text';
import { LinkedProviderEmailText } from '@gamezilla/client/account/linked-providers/linked-provider-email-text';
import { LinkedProviderNameText } from '@gamezilla/client/account/linked-providers/linked-provider-name-text';
import { LinkedProviderUserIdText } from '@gamezilla/client/account/linked-providers/linked-provider-user-id-text';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type LinkedProviderRowProps = {
  accountProviderEntityId: string;
};

/** Composed row for a single linked provider. */
export function LinkedProviderRow({
  accountProviderEntityId,
}: LinkedProviderRowProps): ReactNode {
  return (
    <Box sx={{ gap: 1 }}>
      <LinkedProviderNameText accountProviderEntityId={accountProviderEntityId} />
      <LinkedProviderEmailText
        accountProviderEntityId={accountProviderEntityId}
      />
      <LinkedProviderConnectedAtText
        accountProviderEntityId={accountProviderEntityId}
      />
      <LinkedProviderUserIdText
        accountProviderEntityId={accountProviderEntityId}
      />
    </Box>
  );
}
