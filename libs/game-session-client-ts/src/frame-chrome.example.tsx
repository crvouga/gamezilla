import {
  type SpaceScreenChromeValue,
  SpaceScreenChromeValueProvider,
} from '@libs/spaces-client-ts/space-screen-chrome';
import type { SpacePerson } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';

/**
 * Story and test fixtures for a custom game shown in a space: the space's
 * chrome without a live space, its people given by the caller (the host
 * first, the viewer `you`).
 */

/** A person present in the space, by the id the custom game seats them under. */
export function framePresent(
  id: string,
  name: string,
  over: Partial<SpacePerson> = {}
): SpacePerson {
  return { id, kind: 'person', name, tintKey: id, ...over };
}

/** The space's chrome around a custom game, its callbacks doing nothing. */
export function frameChromeValue(
  people: readonly SpacePerson[],
  role: SpaceScreenChromeValue['role'] = 'host'
): SpaceScreenChromeValue {
  return {
    spaceId: 'space-fixture',
    spaceName: 'Friday game night',
    role,
    hostName: people.find((person) => person.host === true)?.name ?? '',
    people,
    hostOffline: false,
    status: 'ready',
    onBack: () => undefined,
    backLabel: undefined,
    menu: [],
    onLeave: () => undefined,
    onEnd: () => undefined,
    onInvite: undefined,
    onPersonAction: () => undefined,
    personCapabilities: [],
    testIds: {},
  };
}

/** Provides `frameChromeValue(people, role)` to a custom game below it. */
export function FrameChrome(props: {
  readonly people: readonly SpacePerson[];
  readonly role?: SpaceScreenChromeValue['role'] | undefined;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SpaceScreenChromeValueProvider
      value={frameChromeValue(props.people, props.role)}
    >
      {props.children}
    </SpaceScreenChromeValueProvider>
  );
}
