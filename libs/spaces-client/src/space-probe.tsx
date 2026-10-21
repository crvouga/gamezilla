import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Text } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

/**
 * One observation for the harness, outside the visible interface: hidden
 * from everyone (`hidden`, `aria-hidden`), readable by its test id.
 */
export function SpaceProbe(props: {
  readonly testId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical hidden aria-hidden>
      <Text testId={props.testId}>{props.children}</Text>
    </StackVertical>
  );
}
