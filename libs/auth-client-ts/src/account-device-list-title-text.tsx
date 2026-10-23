import { Text, type TextProps } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatDeviceListTitle } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceListTitleTextProps = {
  deviceId: string;
  /** Clamp to this many lines; the surrounding row or heading sets the type. */
  lines?: TextProps['lines'];
};

/** Primary label for a device row — name → model → "Device <id…>" fallback. */
export function AccountDeviceListTitleText(
  props: AccountDeviceListTitleTextProps
): JSX.Element {
  const deviceName = useDeviceColumn(() => props.deviceId, 'deviceName');
  const deviceBrand = useDeviceColumn(() => props.deviceId, 'deviceBrand');
  const deviceModelName = useDeviceColumn(
    () => props.deviceId,
    'deviceModelName'
  );
  const label = createMemo(() =>
    formatDeviceListTitle({
      deviceId: props.deviceId,
      deviceName: deviceName(),
      deviceBrand: deviceBrand(),
      deviceModelName: deviceModelName(),
    })
  );
  return (
    <Text variant="inherit" lines={props.lines}>
      {label()}
    </Text>
  );
}
