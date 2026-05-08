import {
  EM_DASH,
  parseTrimmedStringAttr,
} from '@gamezilla/client/account/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceNameTextProps = {
  deviceId: string;
};

/** `device/deviceName` value, with em-dash fallback. */
export function AccountDeviceNameText({
  deviceId,
}: AccountDeviceNameTextProps): ReactNode {
  const deviceName = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.deviceName,
    attributeValue: parseTrimmedStringAttr,
  });
  return (
    <Text variant="body" numberOfLines={4} label={deviceName ?? EM_DASH} />
  );
}
