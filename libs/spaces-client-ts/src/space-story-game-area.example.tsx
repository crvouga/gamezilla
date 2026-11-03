import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';

/**
 * Story-only stand-in for a game's own screen: games live in their own
 * packages, so a space screen takes the game area as a slot.
 */
export function GameAreaExample(props: {
  readonly title: string;
}): JSX.Element {
  return (
    <EmptyState
      icon={Gamepad2Icon}
      title={props.title}
      body="The chosen game's own screen renders here."
    />
  );
}
