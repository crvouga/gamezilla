import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { EM_DASH } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDevicePlatformTextProps = {
  deviceId: string;
};

/** `devices.platform` value, with em-dash fallback. */
export function AccountDevicePlatformText(
  props: AccountDevicePlatformTextProps
): JSX.Element {
  const platform = useDeviceColumn(() => props.deviceId, 'platform');
  const label = createMemo(() => platform() ?? EM_DASH);
  return <Text variant="inherit">{label()}</Text>;
}
