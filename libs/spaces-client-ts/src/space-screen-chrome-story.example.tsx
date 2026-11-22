import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { JSX } from 'solid-js';
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
    { id: 'share', label: 'Share', onPress: fn() },
    { id: 'people', label: 'People in this space', onPress: fn() },
    { id: 'rename', label: 'Rename', onPress: fn() },
    { id: 'minimize', label: 'Minimize space', onPress: fn() },
    { id: 'leave', label: 'Leave space', tone: 'destructive', onPress: fn() },
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
    leave: Handles.spaceLeave,
    end: Handles.spaceEnd,
  },
};

/**
 * Story-only: a screen inside the host's space, framed as the app frames
 * it (the default stage shell unless the screen claims its own).
 */
export function StorySpaceFrame(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SpaceScreenChromeValueProvider value={STORY_SPACE_CHROME}>
      <SpaceScreenFrame>{props.children}</SpaceScreenFrame>
    </SpaceScreenChromeValueProvider>
  );
}
