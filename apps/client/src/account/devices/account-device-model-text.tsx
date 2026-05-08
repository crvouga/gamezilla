import {
  formatModelLine,
} from '@gamezilla/client/account/devices/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceModelTextProps = {
  deviceId: string;
};

/** Composed `brand modelName` value. */
export function AccountDeviceModelText({
  deviceId,
}: AccountDeviceModelTextProps): ReactNode {
  const deviceBrand = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.deviceBrand.key,

    parse: DeviceAttr.deviceBrand.parse,
  });
  const deviceModelName = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.deviceModelName.key,

    parse: DeviceAttr.deviceModelName.parse,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatModelLine(deviceBrand, deviceModelName)}
    />
  );
}
