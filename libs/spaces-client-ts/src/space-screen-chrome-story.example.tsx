import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  LogOutIcon,
  Minimize2Icon,
  ShareIcon,
  SquarePenIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { fn } from 'storybook/test';
import {
  type SpaceScreenChromeValue,
  SpaceScreenChromeValueProvider,
} from './space-screen-chrome';
import { SpaceScreenFrame } from './space-screen-frame';
import { AVERY, HOSTED_SPACE, JORDAN, MORGAN } from './spaces-story.example';

/** Story-only: the host's own space as its chrome reads, with two guests. */
export const STORY_SPACE_CHROME: SpaceScreenChromeValue = {
  spaceId: HOSTED_SPACE.spaceId,
  spaceName: HOSTED_SPACE.title,
  // What a game's own screen is titled with in the top bar: the game.
  title: 'Chess',
  role: 'host',
  hostName: AVERY.name,
  people: [
    { id: AVERY.id, kind: 'person', name: AVERY.name, host: true, you: true },
    { id: JORDAN.id, kind: 'person', name: JORDAN.name },
    { id: MORGAN.id, kind: 'person', name: MORGAN.name, status: 'away' },
  ],
  hostOffline: false,
  status: 'ready',
  onBack: fn(),
  backLabel: undefined,
  menu: [
    {
      id: 'people',
      label: 'People in this space',
      // As the app words it: "People" beside the icon in a wide top bar.
      shortLabel: 'People',
      icon: UsersIcon,
      testId: Handles.spaceMembersButton,
      onPress: fn(),
    },
    {
      id: 'share',
      label: 'Share',
      icon: ShareIcon,
      testId: Handles.spaceShare,
      onPress: fn(),
    },
    { id: 'rename', label: 'Rename', icon: SquarePenIcon, onPress: fn() },
    {
      id: 'minimize',
      label: 'Minimize space',
      icon: Minimize2Icon,
      onPress: fn(),
    },
    {
      id: 'leave',
      label: 'Leave space',
      icon: LogOutIcon,
      tone: 'destructive',
      onPress: fn(),
    },
  ],
  onLeave: fn(),
  onEnd: fn(),
  onInvite: fn(),
  onPersonAction: fn(),
  personCapabilities: [],
  testIds: {
    back: Handles.spaceBackToSpaces,
    title: Handles.spaceTitle,
    settings: Handles.spaceChromeOverflow,
    name: Handles.spaceMenuName,
    leave: Handles.spaceLeave,
    end: Handles.spaceEnd,
  },
};

/**
 * Story-only: a screen inside the host's space, framed as the app frames
 * it (the default stage shell unless the screen claims its own).
 */
export function StorySpaceFrame(props: {
  /** The game the screen belongs to, as the top bar names it. */
  readonly title?: string | undefined;
  readonly children: JSX.Element;
}): JSX.Element {
  const value: SpaceScreenChromeValue = {
    ...STORY_SPACE_CHROME,
    title: props.title ?? STORY_SPACE_CHROME.title,
  };
  return (
    <SpaceScreenChromeValueProvider value={value}>
      <SpaceScreenFrame>{props.children}</SpaceScreenFrame>
    </SpaceScreenChromeValueProvider>
  );
}
