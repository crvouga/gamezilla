import {
  formatOsLine,
  parseTrimmedStringAttr,
} from '@gamezilla/client/account/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceOsTextProps = {
  deviceId: string;
};

/** Composed `osName osVersion` value. */
export function AccountDeviceOsText({
  deviceId,
}: AccountDeviceOsTextProps): ReactNode {
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
  return (
    <Text variant="body" numberOfLines={4} label={formatOsLine(osName, osVersion)} />
  );
}
