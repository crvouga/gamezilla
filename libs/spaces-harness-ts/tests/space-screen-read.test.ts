import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  type SpaceScreen,
  spaceScreenOf,
} from '@libs/spaces-harness-ts/space-screen-read';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * One person's screen: `handles` show on it, and `menu` shows once its ⋯
 * menu is open (Escape closes it again). With `people`, the list of people
 * covers the top bar: its menu does not open, and Escape closes the list.
 */
function screenHarness(
  handles: readonly string[],
  menu: readonly string[] = [],
  options: { readonly people?: boolean } = {}
): ProductHarness {
  let open = false;
  let people = options.people === true;
  const shows = (handle: string): boolean => {
    if (handle === Handles.spaceMembersClose) return people;
    return handles.includes(handle) || (open && menu.includes(handle));
  };
  const ensure = (handle: string, want: boolean): Promise<void> =>
    shows(handle) === want
      ? Promise.resolve()
      : Promise.reject(
          new Error(`${handle} is not ${want ? 'shown' : 'gone'}`)
        );
  const tap = async (handle: string): Promise<void> => {
    await ensure(handle, true);
    if (handle === Handles.spaceMembersClose) people = false;
    if (handle === Handles.spaceMembersButton) {
      people = true;
      open = false;
    }
    // Under the list of people the menu button takes no tap.
    if (handle === Handles.spaceChromeOverflow && !people) open = true;
  };
  return {
    actors: new Map([
      [
        'bob',
        {
          ui: {
            get: (handle: string) => ({
              layout: async () => null,
              isVisible: async () => shows(handle),
              attribute: async (name: string) =>
                handle === Handles.spaceChromeOverflow &&
                name === 'aria-expanded'
                  ? String(open)
                  : null,
              tap: () => tap(handle),
              expect: {
                visible: () => ensure(handle, true),
                hidden: () => ensure(handle, false),
              },
            }),
            key: async (key: string) => {
              if (key !== 'escape') return;
              if (people) people = false;
              else open = false;
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
    handles: [
      Handles.spaceClose,
      Handles.spaceChromeOverflow,
      Handles.spaceEnd,
    ],
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
    handles: [Handles.spaceClose, Handles.spaceChromeOverflow],
    menu: [Handles.spaceShare, Handles.spaceLeave],
    expected: 'droppedOut',
  },
  {
    title: 'host on a phone game screen, Minimize in the ⋯ menu',
    handles: [Handles.navBack, Handles.spaceChromeOverflow],
    menu: [
      Handles.spaceClose,
      Handles.spaceShare,
      Handles.spaceLeave,
      Handles.spaceEnd,
    ],
    expected: 'space',
  },
  {
    title: 'guest on a phone game screen, Minimize in the ⋯ menu',
    handles: [Handles.navBack, Handles.spaceChromeOverflow],
    menu: [Handles.spaceClose, Handles.spaceShare, Handles.spaceLeave],
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

test.each([
  { title: 'host', exit: Handles.spaceEnd, expected: 'viewingPresence' },
  { title: 'guest', exit: Handles.spaceLeave, expected: 'droppedOut' },
] as const)(
  'a $title looking at the people in the space is placed without losing the list',
  async ({ exit, expected }) => {
    // regression: space-menu-read-under-people-list
    const s = screenHarness(
      [Handles.statusConnectionMissing, Handles.spaceChromeOverflow],
      [Handles.spaceMembersButton, Handles.spaceShare, exit],
      { people: true }
    );
    expect(await spaceScreenOf(s, 'bob')).toBe(expected);
    const ui = s.actors.get('bob')?.ui;
    expect(await ui?.get(Handles.spaceMembersClose).isVisible()).toBe(true);
    expect(await ui?.get(exit).isVisible()).toBe(false);
  }
);
