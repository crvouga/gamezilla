import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatTimestamp } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceLastSeenTextProps = {
  deviceId: string;
};

/** Last-seen timestamp. */
export function AccountDeviceLastSeenText(
  props: AccountDeviceLastSeenTextProps
): JSX.Element {
  const lastSeenAt = useDeviceColumn(() => props.deviceId, 'lastSeenAt');
  const label = createMemo(() => formatTimestamp(lastSeenAt()));
  return <p class="text textBody line-clamp-4">{label()}</p>;
}
