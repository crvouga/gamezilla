import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../../shared';
import { formatOsLine } from '../device-parsers';

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
    attribute: DeviceAttr.osName,
  });
  const osVersion = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.osVersion,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatOsLine(osName, osVersion)}
    />
  );
}
