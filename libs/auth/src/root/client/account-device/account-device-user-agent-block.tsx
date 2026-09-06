import { Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceUserAgentBlockProps = {
  deviceId: string;
};

/** Web user-agent string when present. */
export function AccountDeviceUserAgentBlock(
  props: AccountDeviceUserAgentBlockProps
): JSX.Element {
  const userAgent = useDeviceColumn(props.deviceId, 'userAgent');
  return (
    <Show when={userAgent()}>
      {(ua) => (
        <Text
          variant="caption"
          numberOfLines={6}
          sx={{ userSelect: 'text' }}
          label={ua()}
        />
      )}
    </Show>
  );
}
