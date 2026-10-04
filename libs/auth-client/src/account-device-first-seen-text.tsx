import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatTimestamp } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceFirstSeenTextProps = {
  deviceId: string;
};

/** First-seen timestamp. */
export function AccountDeviceFirstSeenText(
  props: AccountDeviceFirstSeenTextProps
): JSX.Element {
  const firstSeenAt = useDeviceColumn(() => props.deviceId, 'firstSeenAt');
  const label = createMemo(() => formatTimestamp(firstSeenAt()));
  return <p class="text line-clamp-4">{label()}</p>;
}
