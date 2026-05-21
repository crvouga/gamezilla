import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../../shared';
import { formatTimestamp } from '../device-parsers';

export type AccountDeviceFirstSeenTextProps = {
  deviceId: string;
};

/** First-seen timestamp, falling back to `createdAt`. */
export function AccountDeviceFirstSeenText({
  deviceId,
}: AccountDeviceFirstSeenTextProps): ReactNode {
  const firstSeenAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.firstSeenAt,
  });
  const createdAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.createdAt,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatTimestamp(firstSeenAt ?? createdAt)}
    />
  );
}
