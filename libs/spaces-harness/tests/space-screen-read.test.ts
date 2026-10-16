import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness/harness';
import {
  type SpaceScreen,
  spaceScreenOf,
} from '@libs/spaces-harness/space-screen-read';
import { Handles } from '@libs/test-ids-shared/handles';

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
    handles: [Handles.spaceClose, Handles.spaceEnd],
    expected: 'space',
  },
  {
    title: 'guest in a space',
    handles: [Handles.spaceClose],
    expected: 'droppedOut',
  },
];

test.each(SCREENS)(
  'global offline status preserves the location of $title',
  async ({ handles, expected }) => {
    // regression: global-offline-status-misclassifies-space-screen
    const s = screenHarness([Handles.statusConnectionMissing, ...handles]);
    expect(await spaceScreenOf(s, 'bob')).toBe(expected);
  }
);
