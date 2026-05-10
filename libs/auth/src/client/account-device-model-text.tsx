import { formatModelLine } from './device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../shared';
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
    attribute: DeviceAttr.deviceBrand,
  });
  const deviceModelName = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.deviceModelName,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatModelLine(deviceBrand, deviceModelName)}
    />
  );
}
