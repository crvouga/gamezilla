import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceUserAgentBlockProps = {
  deviceId: string;
};

/** Web user-agent string when present, as a section footer run. */
export function AccountDeviceUserAgentBlock(
  props: AccountDeviceUserAgentBlockProps
): JSX.Element {
  const userAgent = useDeviceColumn(() => props.deviceId, 'userAgent');
  return (
    <Show when={userAgent()}>
      {(ua) => (
        <Text variant="inherit" lines={6} wrap="break" selectable>
          {ua()}
        </Text>
      )}
    </Show>
  );
}
