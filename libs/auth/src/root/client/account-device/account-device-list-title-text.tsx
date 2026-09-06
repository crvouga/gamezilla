import { type SxProps, Text, type TextVariant } from '@pkgs/ui-rn';
import { optionalProps } from '@pkgs/ui-rn/components/optional-props';
import type { ReactNode } from 'react';
import { formatDeviceListTitle } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

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
