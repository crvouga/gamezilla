import { Text } from '@pkgs/ui-root-client/text';
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
  return <Text variant="inherit">{label()}</Text>;
}
