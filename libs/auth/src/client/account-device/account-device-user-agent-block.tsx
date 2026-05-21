import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Box, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../../shared';

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
    attribute: DeviceAttr.userAgent,
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
