/**
 * A space around a puzzle surface for stories, tests and harness mounts:
 * the chrome `PuzzleSpaceInGame` reads, without a live space. The viewer
 * hosts it, so they solve; one guest watches. Production never imports
 * this module.
 */

import {
  type SpaceScreenChromeValue,
  SpaceScreenChromeValueProvider,
} from '@libs/spaces-client-ts/space-screen-chrome';
import type { JSX } from 'solid-js';

const none = (): void => undefined;

/** The viewer's own space with one guest, as every puzzle example shows it. */
export const PUZZLE_SPACE_CHROME: SpaceScreenChromeValue = {
  spaceId: 'example-space',
  spaceName: 'Your space',
  role: 'host',
  hostName: 'You',
  people: [
    { id: 'you', kind: 'person', name: 'You', you: true, host: true },
    { id: 'ana', kind: 'person', name: 'ana', initials: 'A' },
  ],
  hostOffline: false,
  status: 'ready',
  onBack: none,
  backLabel: undefined,
  menu: [],
  onLeave: none,
  onEnd: none,
  onInvite: undefined,
  onPersonAction: none,
  personCapabilities: [],
  testIds: {},
};

/** `children` inside the example space. */
export function PuzzleSpaceExample(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SpaceScreenChromeValueProvider value={PUZZLE_SPACE_CHROME}>
      {props.children}
    </SpaceScreenChromeValueProvider>
  );
}
