import {
  formatDeviceListTitle,
} from '@gamezilla/client/account/devices/device-parsers';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text, type SxProps, type TextVariant } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDeviceListTitleTextProps = {
  deviceId: string;
  variant?: TextVariant;
  numberOfLines?: number;
  sx?: SxProps;
};

/** Primary label for a device row — name → model → "Device <id…>" fallback. */
export function AccountDeviceListTitleText({
  deviceId,
  variant,
  numberOfLines,
  sx,
}: AccountDeviceListTitleTextProps): ReactNode {
  const deviceName = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attributeKey: DeviceAttr.deviceName.key,

    parse: DeviceAttr.deviceName.parse,
  });
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
  const label = formatDeviceListTitle({
    deviceId,
    deviceName,
    deviceBrand,
    deviceModelName,
  });
  return (
    <Text
      {...optionalProps({ variant, numberOfLines, sx })}
      label={label}
    />
  );
}
