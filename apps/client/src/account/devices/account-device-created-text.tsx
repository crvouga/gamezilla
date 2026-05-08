import { formatTimestamp } from '@gamezilla/client/account/devices/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceCreatedTextProps = {
  deviceId: string;
};

/** Created-at timestamp. */
export function AccountDeviceCreatedText({
  deviceId,
}: AccountDeviceCreatedTextProps): ReactNode {
  const createdAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.createdAt,
  });
  return (
    <Text variant="body" numberOfLines={4} label={formatTimestamp(createdAt)} />
  );
}
