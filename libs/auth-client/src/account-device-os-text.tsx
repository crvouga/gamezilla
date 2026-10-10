import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { EM_DASH } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceOsTextProps = {
  deviceId: string;
};

/** OS name + version. */
export function AccountDeviceOsText(
  props: AccountDeviceOsTextProps
): JSX.Element {
  const osName = useDeviceColumn(() => props.deviceId, 'osName');
  const osVersion = useDeviceColumn(() => props.deviceId, 'osVersion');
  const label = createMemo(() => {
    const name = osName();
    const version = osVersion();
    return name === null && version === null
      ? EM_DASH
      : [name, version].filter((v) => v !== null).join(' ');
  });
  return <p class="text textBody line-clamp-4">{label()}</p>;
}
