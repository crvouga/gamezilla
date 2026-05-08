import {
  formatTimestamp,
} from '@gamezilla/client/account/devices/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

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
