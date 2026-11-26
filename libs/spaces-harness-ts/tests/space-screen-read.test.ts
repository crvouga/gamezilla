import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  type SpaceScreen,
  spaceScreenOf,
} from '@libs/spaces-harness-ts/space-screen-read';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** The handles a person can see, including a people list over the stage. */
function screenHarness(handles: readonly string[]): ProductHarness {
  return {
    actors: new Map([
      [
        'bob',
        {
          ui: {
            get: (handle: string) => ({
              layout: async () => null,
              isVisible: async () => handles.includes(handle),
            }),
          },
        },
      ],
    ]),
  } as unknown as ProductHarness;
}

const SCREENS: readonly {
  readonly title: string;
  readonly handles: readonly string[];
  readonly expected: SpaceScreen;
}[] = [
  { title: 'lobby', handles: [Handles.spaceCreate], expected: 'lobby' },
  { title: 'another screen', handles: [], expected: 'elsewhere' },
  {
    title: 'host in their space',
    handles: [Handles.spaceClose, Handles.spaceEnd, Handles.spaceLeave],
    expected: 'space',
  },
  {
    title: 'guest on the game screen',
    handles: [Handles.navBack, Handles.spaceClose, Handles.spaceLeave],
    expected: 'droppedOut',
  },
];

test.each(SCREENS)(
  'global offline status preserves the location of $title',
  async ({ handles, expected }) => {
    // regression: global-offline-status-misclassifies-space-screen
    // regression: space-end-beside-everyday-controls
    const s = screenHarness([Handles.statusConnectionMissing, ...handles]);
    expect(await spaceScreenOf(s, 'bob')).toBe(expected);
  }
);

test.each([
  { title: 'host', exit: Handles.spaceEnd, expected: 'viewingPresence' },
  { title: 'guest', exit: Handles.spaceLeave, expected: 'droppedOut' },
] as const)(
  'a $title looking at the people in the space is placed without losing the list',
  async ({ exit, expected }) => {
    // regression: space-menu-read-under-people-list
    const s = screenHarness([
      Handles.statusConnectionMissing,
      Handles.spaceClose,
      Handles.spaceMembersClose,
      exit,
    ]);
    expect(await spaceScreenOf(s, 'bob')).toBe(expected);
    const ui = s.actors.get('bob')?.ui;
    expect(await ui?.get(Handles.spaceMembersClose).isVisible()).toBe(true);
  }
);
