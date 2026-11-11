import type { CatalogueLoadClient } from '@libs/game-puzzle-client-ts/catalogue-load-client';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import {
  defineScreenPlaces,
  placeBehind,
  type ScreenPlaces,
} from '@pkgs/turn-game-client-ts/screen-places';
import type { JSX } from 'solid-js';

/**
 * A game's settings, declared as data: a tree of rows the platform draws.
 * A row opens a nested group of rows or one of the platform's own template
 * screens; a game never supplies a screen.
 */

/** What a settings row opens. */
export type GameSettingsTarget =
  | {
      /** A nested group: its own hub of rows. */
      readonly kind: 'group';
      /** One line under the group's name. */
      readonly subtitle?: (() => JSX.Element) | undefined;
      readonly rows: readonly GameSettingsRow[];
    }
  | {
      /** The platform's catalogue loader, fed by the game's own load. */
      readonly kind: 'catalogue-load';
      readonly load: CatalogueLoadClient;
    };

/** One row of a game's settings. */
export type GameSettingsRow = {
  /** A lowercase slug, unique among the rows beside it. */
  readonly key: string;
  /** Rendered where the row is drawn (copy is rendered, never built ahead). */
  readonly title: () => JSX.Element;
  readonly caption?: (() => JSX.Element) | undefined;
  /**
   * Hides the row from a person `@libs/permissions` denies this to. What
   * the row opens still decides access for itself.
   */
  readonly permission?: AppGrantKey | undefined;
  readonly opens: GameSettingsTarget;
};

/** A game's settings: the rows of its root group. */
export type GameSettings = {
  /** One line under "Settings" in the game's menu. */
  readonly caption: () => JSX.Element;
  /** One line under "Settings" on the settings' own first screen. */
  readonly subtitle?: (() => JSX.Element) | undefined;
  readonly rows: readonly GameSettingsRow[];
};

/** The root group's place, and the first segment of every other. */
export const GAME_SETTINGS_ROOT = 'settings';

const KEY = /^[a-z][a-z0-9-]{0,63}$/;

/** Settings stand in one stage: they are always open. */
export type GameSettingsStage = 'open';

/** A settings screen, named by its path of row keys (`settings/developer`). */
export type GameSettingsPlace = { readonly screen: string };

/** One screen of the tree: the root group, or what a row opens. */
export type GameSettingsNode = {
  readonly place: GameSettingsPlace;
  /** The screen Back leads to; `null` for the root. */
  readonly parent: GameSettingsPlace | null;
  /** The row that opens it; `null` for the root. */
  readonly row: GameSettingsRow | null;
  readonly opens: GameSettingsTarget;
};

/** A game's settings laid out as screens, with the machine that walks them. */
export type GameSettingsTree = {
  readonly root: GameSettingsNode;
  readonly nodes: ReadonlyMap<string, GameSettingsNode>;
  readonly places: ScreenPlaces<GameSettingsStage, GameSettingsPlace>;
};

/** The place `key` opens from the group shown at `group`. */
export function gameSettingsChild(
  group: GameSettingsPlace,
  key: string
): GameSettingsPlace {
  return { screen: `${group.screen}/${key}` };
}

/**
 * The control a row is pressed by: `<game>-<group>-<row>`, the group being
 * `settings` for the root and otherwise the key of the row that opens it
 * (`chess-settings-developer`, `chess-developer-puzzles`).
 */
export function gameSettingsHandle(
  gameId: string,
  group: GameSettingsPlace,
  key: string
): string {
  return `${gameId}-${group.screen.split('/').at(-1) ?? ''}-${key}`;
}

function collect(
  node: GameSettingsNode,
  nodes: Map<string, GameSettingsNode>
): void {
  nodes.set(node.place.screen, node);
  if (node.opens.kind !== 'group') return;
  for (const row of node.opens.rows)
    collect(
      {
        place: gameSettingsChild(node.place, row.key),
        parent: node.place,
        row,
        opens: row.opens,
      },
      nodes
    );
}

/**
 * Lay a game's settings out as screens: one hub place per group and one
 * place per template screen, each behind the group whose row opens it.
 */
export function gameSettingsTree(settings: GameSettings): GameSettingsTree {
  const root: GameSettingsNode = {
    place: { screen: GAME_SETTINGS_ROOT },
    parent: null,
    row: null,
    opens: { kind: 'group', subtitle: settings.subtitle, rows: settings.rows },
  };
  const nodes = new Map<string, GameSettingsNode>();
  collect(root, nodes);
  const places = defineScreenPlaces<GameSettingsStage, GameSettingsPlace>({
    home: { open: root.place },
    screens: { open: [...nodes.keys()] },
    parent: (place) => nodes.get(place.screen)?.parent ?? null,
  });
  return { root, nodes, places };
}

/** Whether a person `can` see `row`. */
function rowShown(
  row: GameSettingsRow,
  can: (permission: AppGrantKey) => boolean
): boolean {
  return row.permission === undefined || can(row.permission);
}

/** The rows of a group a person `can` see, in the order declared. */
export function gameSettingsRows(
  node: GameSettingsNode,
  can: (permission: AppGrantKey) => boolean
): readonly GameSettingsRow[] {
  return node.opens.kind === 'group'
    ? node.opens.rows.filter((row) => rowShown(row, can))
    : [];
}

/**
 * The screen shown for `place`: itself while every row on the way to it is
 * one the person `can` see, otherwise the nearest screen above it that is.
 * A row hidden by a permission is never a way in, even to a device that
 * opened it before the permission was lost.
 */
export function gameSettingsNodeShown(
  tree: GameSettingsTree,
  place: GameSettingsPlace,
  can: (permission: AppGrantKey) => boolean
): GameSettingsNode {
  const chain: GameSettingsNode[] = [];
  let at = tree.nodes.get(place.screen) ?? tree.root;
  while (at.parent !== null) {
    chain.unshift(at);
    at = tree.nodes.get(at.parent.screen) ?? tree.root;
  }
  let shown = tree.root;
  for (const node of chain) {
    if (node.row !== null && !rowShown(node.row, can)) break;
    shown = node;
  }
  return shown;
}

/** The screen Back leads to from `place`; `null` from the root. */
export function gameSettingsBehind(
  tree: GameSettingsTree,
  place: GameSettingsPlace
): GameSettingsPlace | null {
  return placeBehind(tree.places, 'open', place);
}

/** Every permission the tree's rows name, each once. */
export function gameSettingsPermissions(
  tree: GameSettingsTree
): readonly AppGrantKey[] {
  const seen = new Set<AppGrantKey>();
  for (const node of tree.nodes.values())
    if (node.row?.permission !== undefined) seen.add(node.row.permission);
  return [...seen];
}

function assertRows(
  gameId: string,
  group: GameSettingsPlace,
  rows: readonly GameSettingsRow[],
  handles: Set<string>
): void {
  const keys = new Set<string>();
  for (const row of rows) {
    const where = `${gameId}: settings row "${group.screen}/${row.key}"`;
    if (!KEY.test(row.key))
      throw new Error(`${where} needs a lowercase slug for its key`);
    if (keys.has(row.key)) throw new Error(`${where} is declared twice`);
    keys.add(row.key);
    const handle = gameSettingsHandle(gameId, group, row.key);
    if (handles.has(handle))
      throw new Error(
        `${where} shares its control "${handle}" with another row: rename one`
      );
    handles.add(handle);
    if (typeof row.title !== 'function')
      throw new Error(`${where} needs a title`);
    if (row.opens.kind === 'group')
      assertRows(
        gameId,
        gameSettingsChild(group, row.key),
        row.opens.rows,
        handles
      );
    else if (typeof row.opens.load.useLoad !== 'function')
      throw new Error(
        `${where} opens the catalogue loader but supplies no load (opens.load.useLoad)`
      );
  }
}

/**
 * A game's settings, checked once when the game is defined: every row has
 * a slug key unique in its group, a title, a control of its own, and
 * something to open. Settings are data only: a `Screen` is refused.
 */
export function assertGameSettings(
  gameId: string,
  settings: GameSettings
): void {
  if ('Screen' in settings)
    throw new Error(
      `${gameId}: settings.Screen is not part of the contract — declare settings.rows; the platform draws every settings screen`
    );
  if (typeof settings.caption !== 'function')
    throw new Error(`${gameId}: settings needs a caption for the game's menu`);
  if (settings.rows.length === 0)
    throw new Error(
      `${gameId}: settings declares no rows — leave settings out, or declare one`
    );
  assertRows(
    gameId,
    { screen: GAME_SETTINGS_ROOT },
    settings.rows,
    new Set<string>()
  );
}
