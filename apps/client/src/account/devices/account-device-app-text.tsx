import {
  formatAppLine,
  parseTrimmedStringAttr,
} from '@gamezilla/client/account/devices/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

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
    attributeKey: DeviceAttr.appVersion,
    attributeValue: parseTrimmedStringAttr,
  });
  const appBuildNumber = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.appBuildNumber,
    attributeValue: parseTrimmedStringAttr,
  });
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatAppLine(appVersion, appBuildNumber)}
    />
  );
}
