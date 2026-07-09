import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';
import { DeviceField, useDeviceColumn } from '../use-device-column';
import { formatDeviceListCaption } from '../device-parsers';

export type AccountDeviceListCaptionTextProps = {
  deviceId: string;
  variant?: TextVariant;
  numberOfLines?: number;
  sx?: SxProps;
};

/** Secondary line for device list rows (OS + last seen). */
export function AccountDeviceListCaptionText({
  deviceId,
  variant,
  numberOfLines,
  sx,
}: AccountDeviceListCaptionTextProps): ReactNode {
  const osName = useDeviceColumn(deviceId, DeviceField.osName);
  const osVersion = useDeviceColumn(deviceId, DeviceField.osVersion);
  const lastSeenAt = useDeviceColumn(deviceId, DeviceField.lastSeenAt);
  const createdAt = useDeviceColumn(deviceId, DeviceField.createdAt);
  const label = formatDeviceListCaption({
    osName,
    osVersion,
    lastSeenAt,
    createdAt,
  });
  return (
    <Text {...optionalProps({ variant, numberOfLines, sx })} label={label} />
  );
}
