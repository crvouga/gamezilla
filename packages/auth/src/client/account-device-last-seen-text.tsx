import { formatTimestamp } from './device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../shared';
import { Text } from '@gamezilla/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceLastSeenTextProps = {
  deviceId: string;
};

/** Last-seen timestamp. */
export function AccountDeviceLastSeenText({
  deviceId,
}: AccountDeviceLastSeenTextProps): ReactNode {
  const lastSeenAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.lastSeenAt,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatTimestamp(lastSeenAt)}
    />
  );
}
