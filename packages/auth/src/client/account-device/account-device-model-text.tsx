import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Text } from '@gamezilla/ui';
import type { ReactNode } from 'react';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../../shared';
import { formatModelLine } from '../device-parsers';

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
