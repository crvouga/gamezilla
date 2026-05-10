import { EM_DASH } from './device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../shared';
import { Text } from '@gamezilla/ui';
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
    attribute: DeviceAttr.deviceName,
  });
  return (
    <Text variant="body" numberOfLines={4} label={deviceName ?? EM_DASH} />
  );
}
