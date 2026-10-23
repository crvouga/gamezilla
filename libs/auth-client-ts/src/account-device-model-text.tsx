import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { EM_DASH } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceModelTextProps = {
  deviceId: string;
};

/** Device model name. */
export function AccountDeviceModelText(
  props: AccountDeviceModelTextProps
): JSX.Element {
  const model = useDeviceColumn(() => props.deviceId, 'deviceModelName');
  const label = createMemo(() => model() ?? EM_DASH);
  return <Text variant="inherit">{label()}</Text>;
}
