import { formatDeviceListCaption } from './device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../shared';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceListCaptionTextProps = {
  deviceId: string;
};

/** OS line + last seen, formatted. */
export function AccountDeviceListCaptionText({
  deviceId,
}: AccountDeviceListCaptionTextProps): ReactNode {
  const osName = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.osName,
  });
  const osVersion = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.osVersion,
  });
  const lastSeenAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.lastSeenAt,
  });
  const createdAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.createdAt,
  });
  const label = formatDeviceListCaption({
    osName,
    osVersion,
    lastSeenAt,
    createdAt,
  });
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}
