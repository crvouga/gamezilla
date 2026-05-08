import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Box, Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type AccountDeviceUserAgentBlockProps = {
  deviceId: string;
};

/** Renders the `device/userAgent` block, or `null` when absent. */
export function AccountDeviceUserAgentBlock({
  deviceId,
}: AccountDeviceUserAgentBlockProps): ReactNode {
  const userAgent = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.userAgent.key,

    parse: DeviceAttr.userAgent.parse,
  });
  if (userAgent === null) return null;
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>User agent</Trans>}
      />
      <Text variant="caption" selectable label={userAgent} />
    </Box>
  );
}
