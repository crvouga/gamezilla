import { CatalogueLoadScreen } from '@libs/game-puzzle-client-ts/catalogue-load-screen';
import { useCan } from '@libs/permissions-client-ts/use-can';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import {
  type Accessor,
  createMemo,
  type JSX,
  Match,
  Switch,
  untrack,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  type GameSettings,
  type GameSettingsNode,
  type GameSettingsTree,
  gameSettingsBehind,
  gameSettingsChild,
  gameSettingsHandle,
  gameSettingsNodeShown,
  gameSettingsPermissions,
  gameSettingsRows,
  gameSettingsTree,
} from './game-settings';
import {
  type GameSettingsRowView,
  GameSettingsScreenView,
} from './game-settings-screen-view';

/** What the person may do, for every permission the tree's rows name. */
function useSettingsPermissions(
  tree: GameSettingsTree
): (permission: AppGrantKey) => boolean {
  const decisions = new Map<AppGrantKey, Accessor<boolean>>(
    gameSettingsPermissions(tree).map((permission) => [
      permission,
      useCan(permission),
    ])
  );
  return (permission) => decisions.get(permission)?.() ?? false;
}

/** The root group's name. */
function SettingsTitle(): JSX.Element {
  return <Trans>Settings</Trans>;
}

/** One group of the tree as `GameSettingsScreenView` draws it. */
function GameSettingsGroup(props: {
  gameId: string;
  node: GameSettingsNode;
  can: (permission: AppGrantKey) => boolean;
  onOpen: (place: { readonly screen: string }) => void;
}): JSX.Element {
  const rows = createMemo((): GameSettingsRowView[] =>
    gameSettingsRows(props.node, props.can).map((row) => ({
      key: row.key,
      title: <Dynamic component={row.title} />,
      caption:
        row.caption === undefined ? undefined : (
          <Dynamic component={row.caption} />
        ),
      testId: gameSettingsHandle(props.gameId, props.node.place, row.key),
      opens: gameSettingsChild(props.node.place, row.key),
    }))
  );
  const subtitle = (): (() => JSX.Element) | undefined =>
    props.node.opens.kind === 'group' ? props.node.opens.subtitle : undefined;
  return (
    <GameSettingsScreenView
      place={props.node.place}
      title={<Dynamic component={props.node.row?.title ?? SettingsTitle} />}
      subtitle={
        subtitle() === undefined ? undefined : (
          <Dynamic component={subtitle()} />
        )
      }
      rows={rows()}
      onOpen={props.onOpen}
    />
  );
}

/**
 * A game's settings in a space: the platform draws the tree of rows the
 * game declared (`GameClient.settings`). Which group or template screen
 * shows is this device's own place; Back walks up the tree and, from the
 * root, returns to the game's menu.
 */
export function GameSettingsScreen(props: {
  gameId: string;
  settings: GameSettings;
  onBack: () => void;
}): JSX.Element {
  // A game's settings are declared once, when it is defined.
  const tree = untrack(() => gameSettingsTree(props.settings));
  const nav = useScreenPlace(tree.places, () => 'open' as const);
  const can = useSettingsPermissions(tree);
  const choices = useGameChoicesName();
  const node = createMemo(() => gameSettingsNodeShown(tree, nav.place(), can));
  const back = (): boolean => {
    const behind = gameSettingsBehind(tree, node().place);
    if (behind === null) return false;
    nav.open(behind);
    return true;
  };
  const load = () => {
    const opens = node().opens;
    return opens.kind === 'catalogue-load' ? opens.load : null;
  };
  return (
    <>
      <DefineBackButton
        onPress={() => {
          if (!back()) props.onBack();
        }}
        label={node().parent === null ? choices() : undefined}
      />
      <Switch>
        <Match when={node().opens.kind === 'group'}>
          <GameSettingsGroup
            gameId={props.gameId}
            node={node()}
            can={can}
            onOpen={nav.open}
          />
        </Match>
        <Match when={load()} keyed>
          {(client) => (
            <CatalogueLoadScreen
              client={client}
              frame={{ kind: 'space', onLeave: () => void back() }}
            />
          )}
        </Match>
      </Switch>
    </>
  );
}
