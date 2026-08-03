import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';
import { useDeviceColumn } from '../use-device-column';
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
  const deviceName = useDeviceColumn(deviceId, 'deviceName');
  const deviceBrand = useDeviceColumn(deviceId, 'deviceBrand');
  const deviceModelName = useDeviceColumn(deviceId, 'deviceModelName');
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
