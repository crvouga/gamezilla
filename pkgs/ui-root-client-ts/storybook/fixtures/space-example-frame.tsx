import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import type { SpaceScreenChrome } from '../../src/space-shell/index';
import type { SpaceRole } from '../../src/space-types';

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
  onMembers: () => void;
  onRename: () => void;
  onMinimize: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onPersonAction: (personId: string, action: string) => void;
  onInvite: () => void;
};

/** Row 1 of bob's space and the people row's callbacks. */
export function spaceExampleChrome(
  spies: SpaceExampleSpies & { role: SpaceRole }
): SpaceScreenChrome {
  return {
    spaceName: 'bob’s space',
    onBack: spies.onBack,
    onMembers: spies.onMembers,
    onRename: spies.role === 'host' ? spies.onRename : undefined,
    onLeave: spies.onLeave,
    onEnd: spies.role === 'host' ? spies.onEnd : undefined,
    onMinimize: spies.onMinimize,
    onPersonAction: spies.onPersonAction,
    onInvite: spies.onInvite,
  };
}
