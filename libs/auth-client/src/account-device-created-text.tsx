import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatTimestamp } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceCreatedTextProps = {
  deviceId: string;
};

/** Created-at timestamp. */
export function AccountDeviceCreatedText(
  props: AccountDeviceCreatedTextProps
): JSX.Element {
  const createdAt = useDeviceColumn(() => props.deviceId, 'createdAt');
  const label = createMemo(() => formatTimestamp(createdAt()));
  return <p class="text line-clamp-4">{label()}</p>;
}
