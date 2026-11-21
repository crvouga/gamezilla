import type { JSX } from 'solid-js';
import type { SpaceScreenChrome } from '../../src/space-shell/index';

/** A space screen fills the story viewport, as it fills a phone. */
export function SpaceExampleFrame(props: {
  children: JSX.Element;
}): JSX.Element {
  return <div class="box h-dvh min-h-0 overflow-hidden">{props.children}</div>;
}

/** The callbacks a story spies on, from its args. */
export type SpaceExampleSpies = {
  onBack: () => void;
  onSettings: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onPersonAction: (personId: string, action: string) => void;
  onInvite: () => void;
};

/** Row 1 of bob's space and the people row's callbacks. */
export function spaceExampleChrome(
  spies: SpaceExampleSpies,
  invite: boolean
): SpaceScreenChrome {
  return {
    spaceName: 'bob’s space',
    onBack: () => spies.onBack(),
    onSettings: () => spies.onSettings(),
    onLeave: () => spies.onLeave(),
    onEnd: () => spies.onEnd(),
    onPersonAction: (id, action) => spies.onPersonAction(id, action),
    onInvite: invite ? () => spies.onInvite() : undefined,
  };
}
