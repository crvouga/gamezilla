/**
 * A game's settings as a machine derived from data: every group is a hub
 * place, Back walks up the tree to the root and then leaves, and a row a
 * permission hides is never a way in.
 */
import { describe, expect, test } from 'bun:test';
import {
  assertGameSettings,
  GAME_SETTINGS_ROOT,
  type GameSettings,
  type GameSettingsNode,
  type GameSettingsPlace,
  type GameSettingsRow,
  type GameSettingsTree,
  gameSettingsBehind,
  gameSettingsChild,
  gameSettingsHandle,
  gameSettingsNodeShown,
  gameSettingsPermissions,
  gameSettingsRows,
  gameSettingsTree,
} from '@libs/game-menu-client-ts/game-settings';
import type { CatalogueLoadClient } from '@libs/game-puzzle-client-ts/catalogue-load-client';
import {
  type AppGrantKey,
  PERMISSION,
} from '@libs/permissions-shared-ts/permission-catalog';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { placeIn, stageShows } from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const load = {
  useLoad: () => {
    throw new Error('not read in these tests');
  },
  copy: {
    title: () => 'Load laps',
    subtitle: () => 'From the shared file',
    sourceName: 'lap file',
    fileLabel: () => 'Lap file',
    fileAccept: '.csv',
    fileHint: () => 'Choose a .csv file.',
  },
} satisfies CatalogueLoadClient;

const PERMISSIONS: readonly AppGrantKey[] = [
  PERMISSION.puzzlesManage,
  PERMISSION.spacesSelectGame,
];

/** One row under `key`: gated or not, opening the loader or a nested group. */
function rowOf(
  key: string,
  nested: fc.Arbitrary<readonly GameSettingsRow[] | undefined>
): fc.Arbitrary<GameSettingsRow> {
  return fc
    .record({
      permission: fc.option(fc.constantFrom(...PERMISSIONS), {
        nil: undefined,
      }),
      rows: nested,
    })
    .map(
      (given): GameSettingsRow => ({
        key,
        title: () => key,
        permission: given.permission,
        opens:
          given.rows === undefined
            ? { kind: 'catalogue-load', load }
            : { kind: 'group', rows: given.rows },
      })
    );
}

/** A settings tree of any shape, at most `depth` groups deep. */
function rowsOf(depth: number): fc.Arbitrary<readonly GameSettingsRow[]> {
  const nested =
    depth === 0
      ? fc.constant(undefined)
      : fc.option(rowsOf(depth - 1), { nil: undefined });
  return fc
    .uniqueArray(fc.constantFrom('a', 'b', 'c', 'd'), { maxLength: 3 })
    .chain((keys) => fc.tuple(...keys.map((key) => rowOf(key, nested))));
}

const rows = rowsOf(3);
const settings = rows.map(
  (declared): GameSettings => ({ caption: () => 'Laps', rows: declared })
);
const granted = fc.subarray([...PERMISSIONS]);

/** Every row on the way to `shown` is one the person sees. */
function expectWayInShown(
  tree: GameSettingsTree,
  shown: GameSettingsNode,
  can: (permission: AppGrantKey) => boolean
): void {
  let at = shown;
  while (at.parent !== null) {
    const parent = tree.nodes.get(at.parent.screen);
    if (parent === undefined) throw new Error('a parent is missing');
    const row = at.row;
    if (row === null) throw new Error('a screen below the root has a row');
    expect(gameSettingsRows(parent, can)).toContain(row);
    at = parent;
  }
}

describe("a game's settings places", () => {
  test('every screen of the tree is a place, and Back walks up to the root', () => {
    assertProperty(
      'game settings: back reaches the root from every screen',
      fc.property(settings, (declared) => {
        const tree = gameSettingsTree(declared);
        expect(placeIn(tree.places, 'open', null)).toEqual({
          screen: GAME_SETTINGS_ROOT,
        });
        for (const node of tree.nodes.values()) {
          expect(stageShows(tree.places, 'open', node.place)).toBe(true);
          let at: GameSettingsPlace | null = node.place;
          let steps = 0;
          while (at !== null && steps <= tree.nodes.size) {
            const behind: GameSettingsPlace | null = gameSettingsBehind(
              tree,
              at
            );
            // Each step back is the group whose row opened this screen.
            if (behind !== null)
              expect(at.screen.startsWith(`${behind.screen}/`)).toBe(true);
            at = behind;
            steps += 1;
          }
          expect(at).toBeNull();
          expect(steps).toBe(node.place.screen.split('/').length);
        }
      })
    );
  });

  test('a row hidden by a permission is offered nowhere and opens nothing', () => {
    assertProperty(
      'game settings: a hidden row is never a way in',
      fc.property(settings, granted, (declared, allowed) => {
        const tree = gameSettingsTree(declared);
        const can = (permission: AppGrantKey) => allowed.includes(permission);
        for (const node of tree.nodes.values()) {
          const shown = gameSettingsNodeShown(tree, node.place, can);
          // The screen shown is the one asked for, or one above it.
          expect(
            node.place.screen === shown.place.screen ||
              node.place.screen.startsWith(`${shown.place.screen}/`)
          ).toBe(true);
          expectWayInShown(tree, shown, can);
          // The rows a group offers are exactly its permitted ones.
          for (const row of gameSettingsRows(node, can))
            expect(row.permission === undefined || can(row.permission)).toBe(
              true
            );
        }
      })
    );
  });

  test('with every permission granted, each screen shows itself', () => {
    assertProperty(
      'game settings: nothing hidden, nothing redirected',
      fc.property(settings, (declared) => {
        const tree = gameSettingsTree(declared);
        for (const node of tree.nodes.values())
          expect(gameSettingsNodeShown(tree, node.place, () => true)).toBe(
            node
          );
      })
    );
  });
});

/** A tree shaped like a game's: a developer group holding a gated loader. */
const LAPS: GameSettings = {
  caption: () => 'Preferences and developer tools',
  rows: [
    {
      key: 'developer',
      title: () => 'Developer',
      opens: {
        kind: 'group',
        rows: [
          {
            key: 'laps',
            title: () => 'Load laps',
            permission: PERMISSION.puzzlesManage,
            opens: { kind: 'catalogue-load', load },
          },
        ],
      },
    },
  ],
};

describe("a game's settings, declared as data", () => {
  const tree = gameSettingsTree(LAPS);
  const root: GameSettingsPlace = { screen: GAME_SETTINGS_ROOT };
  const developer = gameSettingsChild(root, 'developer');
  const laps = gameSettingsChild(developer, 'laps');

  test('one hub place per group, one place per template screen', () => {
    expect([...tree.nodes.keys()]).toEqual([
      'settings',
      'settings/developer',
      'settings/developer/laps',
    ]);
    expect(tree.nodes.get(laps.screen)?.opens.kind).toBe('catalogue-load');
    expect(gameSettingsBehind(tree, laps)).toEqual(developer);
    expect(gameSettingsBehind(tree, developer)).toEqual(root);
    expect(gameSettingsBehind(tree, root)).toBeNull();
  });

  test('a row is pressed by <game>-<group>-<row>', () => {
    expect(gameSettingsHandle('race', root, 'developer')).toBe(
      'race-settings-developer'
    );
    expect(gameSettingsHandle('race', developer, 'laps')).toBe(
      'race-developer-laps'
    );
  });

  test('a denied permission hides its row and what the row opened', () => {
    const group = tree.nodes.get(developer.screen);
    if (group === undefined) throw new Error('the developer group is missing');
    expect(gameSettingsPermissions(tree)).toEqual([PERMISSION.puzzlesManage]);
    expect(gameSettingsRows(group, () => true).map((row) => row.key)).toEqual([
      'laps',
    ]);
    expect(gameSettingsRows(group, () => false)).toEqual([]);
    // A device that had the loader open stands on the group once denied.
    expect(gameSettingsNodeShown(tree, laps, () => false).place).toEqual(
      developer
    );
    expect(gameSettingsNodeShown(tree, laps, () => true).place).toEqual(laps);
  });

  test('settings are checked when the game is defined', () => {
    expect(() => assertGameSettings('race', LAPS)).not.toThrow();
    expect(() => assertGameSettings('race', { ...LAPS, rows: [] })).toThrow(
      'race: settings declares no rows'
    );
    const [first] = LAPS.rows;
    if (first === undefined) throw new Error('LAPS has a row');
    expect(() =>
      assertGameSettings('race', { ...LAPS, rows: [first, first] })
    ).toThrow('race: settings row "settings/developer" is declared twice');
    expect(() =>
      assertGameSettings('race', {
        ...LAPS,
        rows: [{ ...first, key: 'Developer Tools' }],
      })
    ).toThrow('needs a lowercase slug for its key');
    expect(() =>
      assertGameSettings('race', {
        ...LAPS,
        // Two rows that would both be pressed by `race-settings-laps`.
        rows: [
          {
            key: 'laps',
            title: () => 'Laps',
            opens: { kind: 'group', rows: [] },
          },
          {
            key: 'settings',
            title: () => 'More',
            opens: {
              kind: 'group',
              rows: [
                {
                  key: 'laps',
                  title: () => 'Laps',
                  opens: { kind: 'catalogue-load', load },
                },
              ],
            },
          },
        ],
      })
    ).toThrow('shares its control "race-settings-laps" with another row');
  });

  test('a settings Screen is refused: settings are data only', () => {
    expect(() =>
      assertGameSettings('race', {
        ...LAPS,
        // A screen component, as a game written against the old contract sends it.
        ...({ Screen: () => null } as object),
      })
    ).toThrow('race: settings.Screen is not part of the contract');
  });
});
