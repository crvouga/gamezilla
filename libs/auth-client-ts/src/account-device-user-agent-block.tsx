import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export type AccountDeviceUserAgentBlockProps = {
  readonly userAgent: string | null;
};

/** Web user-agent string when present, as a section footer run. */
export function AccountDeviceUserAgentBlock(
  props: AccountDeviceUserAgentBlockProps
): JSX.Element {
  return (
    <Show when={props.userAgent}>
      {(ua) => (
        <Text variant="inherit" lines={6} wrap="break" selectable>
          {ua()}
        </Text>
      )}
    </Show>
  );
}
