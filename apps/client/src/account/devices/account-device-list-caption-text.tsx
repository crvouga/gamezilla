import {
  formatDeviceListCaption,
} from '@gamezilla/client/account/devices/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
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
    attributeKey: DeviceAttr.osName.key,

    parse: DeviceAttr.osName.parse,
  });
  const osVersion = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.osVersion.key,

    parse: DeviceAttr.osVersion.parse,
  });
  const lastSeenAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.lastSeenAt.key,

    parse: DeviceAttr.lastSeenAt.parse,
  });
  const createdAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.createdAt.key,

    parse: DeviceAttr.createdAt.parse,
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
