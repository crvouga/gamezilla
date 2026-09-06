import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatDeviceListTitle } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceListTitleTextProps = {
  deviceId: string;
  variant?: TextVariant | undefined;
  numberOfLines?: number | undefined;
  sx?: SxProps | undefined;
};

/** Primary label for a device row — name → model → "Device <id…>" fallback. */
export function AccountDeviceListTitleText(
  props: AccountDeviceListTitleTextProps
): JSX.Element {
  const deviceName = useDeviceColumn(props.deviceId, 'deviceName');
  const deviceBrand = useDeviceColumn(props.deviceId, 'deviceBrand');
  const deviceModelName = useDeviceColumn(props.deviceId, 'deviceModelName');
  const label = createMemo(() =>
    formatDeviceListTitle({
      deviceId: props.deviceId,
      deviceName: deviceName(),
      deviceBrand: deviceBrand(),
      deviceModelName: deviceModelName(),
    })
  );
  return (
    <Text
      variant={props.variant}
      numberOfLines={props.numberOfLines}
      sx={props.sx}
      label={label()}
    />
  );
}
