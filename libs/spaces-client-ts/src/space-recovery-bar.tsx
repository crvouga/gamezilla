import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';

/**
 * The bottom bar of a space screen that cannot go on (ended, unreachable,
 * not found, offline): its ways on, side by side, centred under the
 * centred message they answer and never wider than a form, so a wide
 * window does not pin them to one edge.
 */
export function SpaceRecoveryBar(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <StackHorizontal gap="sm" width="full" maxWidth="form" self="center">
      {props.children}
    </StackHorizontal>
  );
}
