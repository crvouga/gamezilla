import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { EM_DASH } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceNameTextProps = {
  deviceId: string;
};

/** Device display name. */
export function AccountDeviceNameText(
  props: AccountDeviceNameTextProps
): JSX.Element {
  const name = useDeviceColumn(() => props.deviceId, 'deviceName');
  const label = createMemo(() => name() ?? EM_DASH);
  return <p class="text line-clamp-4">{label()}</p>;
}
