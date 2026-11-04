import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  type SpaceScreen,
  spaceScreenOf,
} from '@libs/spaces-harness-ts/space-screen-read';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * One person's screen: `handles` show on it, and `menu` shows once its ⋯
 * menu is open (Escape closes it again).
 */
function screenHarness(
  handles: readonly string[],
  menu: readonly string[] = []
): ProductHarness {
  let open = false;
  const shows = (handle: string): boolean =>
    handles.includes(handle) || (open && menu.includes(handle));
  const ensure = (handle: string, want: boolean): Promise<void> =>
    shows(handle) === want
      ? Promise.resolve()
      : Promise.reject(
          new Error(`${handle} is not ${want ? 'shown' : 'gone'}`)
        );
  return {
    actors: new Map([
      [
        'bob',
        {
          ui: {
            get: (handle: string) => ({
              layout: async () => null,
              isVisible: async () => shows(handle),
              tap: async () => {
                await ensure(handle, true);
                if (handle === Handles.spaceChromeOverflow) open = true;
              },
              expect: {
                visible: () => ensure(handle, true),
                hidden: () => ensure(handle, false),
              },
            }),
            key: async (key: string) => {
              if (key === 'escape') open = false;
            },
          },
        },
      ],
    ]),
  } as unknown as ProductHarness;
}

const SCREENS: readonly {
  readonly title: string;
  readonly handles: readonly string[];
  readonly menu?: readonly string[];
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
    title: 'host whose End is in the ⋯ menu',
    handles: [Handles.spaceClose, Handles.spaceChromeOverflow],
    menu: [Handles.spaceShare, Handles.spaceLeave, Handles.spaceEnd],
    expected: 'space',
  },
  {
    title: 'guest in a space',
    handles: [Handles.spaceClose],
    expected: 'droppedOut',
  },
  {
    title: 'guest whose ⋯ menu offers only Leave',
    handles: [Handles.spaceClose, Handles.spaceChromeOverflow],
    menu: [Handles.spaceShare, Handles.spaceLeave],
    expected: 'droppedOut',
  },
];

test.each(SCREENS)(
  'global offline status preserves the location of $title',
  async ({ handles, menu, expected }) => {
    // regression: global-offline-status-misclassifies-space-screen
    // regression: space-end-beside-everyday-controls
    const s = screenHarness(
      [Handles.statusConnectionMissing, ...handles],
      menu
    );
    expect(await spaceScreenOf(s, 'bob')).toBe(expected);
  }
);

test('looking for End in the ⋯ menu closes the menu again', async () => {
  // regression: space-end-beside-everyday-controls
  const s = screenHarness(
    [
      Handles.statusConnectionMissing,
      Handles.spaceClose,
      Handles.spaceChromeOverflow,
    ],
    [Handles.spaceShare, Handles.spaceLeave, Handles.spaceEnd]
  );
  expect(await spaceScreenOf(s, 'bob')).toBe('space');
  const ui = s.actors.get('bob')?.ui;
  expect(await ui?.get(Handles.spaceEnd).isVisible()).toBe(false);
});
