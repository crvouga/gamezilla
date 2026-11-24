import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Minimize2Icon, ShareIcon, UsersIcon } from '../../src/icons';
import type { SpaceScreenChrome } from '../../src/space-shell/index';

/**
 * A space screen fills the story viewport, as it fills a phone. It is the
 * example's root, so it carries `ExampleRoot`'s identity.
 */
export function SpaceExampleFrame(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box h-dvh min-h-0 overflow-hidden"
      {...dataAttrs({ component: 'ExampleRoot' })}
    >
      {props.children}
    </div>
  );
}

/** The callbacks a story spies on, from its args. */
export type SpaceExampleSpies = {
  onBack: () => void;
  /** A row of the space menu was chosen. */
  onSpaceMenu: (id: string) => void;
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
    menu: [
      { id: 'people', label: 'People in this space', icon: UsersIcon },
      { id: 'share', label: 'Share', icon: ShareIcon },
      { id: 'minimize', label: 'Minimize space', icon: Minimize2Icon },
    ].map((item) => ({ ...item, onPress: () => spies.onSpaceMenu(item.id) })),
    onLeave: () => spies.onLeave(),
    onEnd: () => spies.onEnd(),
    onPersonAction: (id, action) => spies.onPersonAction(id, action),
    onInvite: invite ? () => spies.onInvite() : undefined,
  };
}
