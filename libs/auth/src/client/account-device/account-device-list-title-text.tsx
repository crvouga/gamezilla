import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Text, type SxProps, type TextVariant } from '@gamezilla/ui';
import { optionalProps } from '@gamezilla/ui/components/optional-props';
import type { ReactNode } from 'react';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../../shared';
import { formatDeviceListTitle } from '../device-parsers';

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
    attribute: DeviceAttr.deviceName,
  });
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
  const label = formatDeviceListTitle({
    deviceId,
    deviceName,
    deviceBrand,
    deviceModelName,
  });
  return (
    <Text {...optionalProps({ variant, numberOfLines, sx })} label={label} />
  );
}
