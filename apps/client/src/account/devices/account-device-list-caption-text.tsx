import {
  formatDeviceListCaption,
  parseTrimmedStringAttr,
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
    attributeKey: DeviceAttr.osName,
    attributeValue: parseTrimmedStringAttr,
  });
  const osVersion = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.osVersion,
    attributeValue: parseTrimmedStringAttr,
  });
  const lastSeenAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.lastSeenAt,
    attributeValue: parseTrimmedStringAttr,
  });
  const createdAt = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.createdAt,
    attributeValue: parseTrimmedStringAttr,
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
