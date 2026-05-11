import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Text } from '@gamezilla/ui';
import type { ReactNode } from 'react';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../../shared';
import { formatAppLine } from '../device-parsers';

export type AccountDeviceAppTextProps = {
  deviceId: string;
};

/** Composed `appVersion (build appBuildNumber)` value. */
export function AccountDeviceAppText({
  deviceId,
}: AccountDeviceAppTextProps): ReactNode {
  const appVersion = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.appVersion,
  });
  const appBuildNumber = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.appBuildNumber,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatAppLine(appVersion, appBuildNumber)}
    />
  );
}
