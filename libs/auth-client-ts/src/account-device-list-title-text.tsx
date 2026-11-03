import { Text, type TextProps } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type { AccountDeviceView } from './account-device-view';
import { formatDeviceListTitle } from './device-parsers';

export type AccountDeviceListTitleTextProps = {
  readonly device: AccountDeviceView;
  /** Clamp to this many lines; the surrounding row or heading sets the type. */
  readonly lines?: TextProps['lines'];
};

/** Primary label for a device row — name → model → "Device <id…>" fallback. */
export function AccountDeviceListTitleText(
  props: AccountDeviceListTitleTextProps
): JSX.Element {
  const label = createMemo(() =>
    formatDeviceListTitle({
      deviceId: props.device.id,
      deviceName: props.device.deviceName,
      deviceBrand: props.device.deviceBrand,
      deviceModelName: props.device.deviceModelName,
    })
  );
  return (
    <Text variant="inherit" lines={props.lines}>
      {label()}
    </Text>
  );
}
