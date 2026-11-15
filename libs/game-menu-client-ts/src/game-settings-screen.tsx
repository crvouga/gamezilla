import { CatalogueLoadScreen } from '@libs/game-puzzle-client-ts/catalogue-load-screen';
import { useCan } from '@libs/permissions-client-ts/use-can';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import {
  type Accessor,
  createMemo,
  type JSX,
  Match,
  Show,
  Switch,
  untrack,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  type GameSettings,
  type GameSettingsNode,
  type GameSettingsPlace,
  type GameSettingsTree,
  gameSettingsBehind,
  gameSettingsChild,
  gameSettingsHandle,
  gameSettingsNodeShown,
  gameSettingsOpening,
  gameSettingsPermissions,
  gameSettingsRows,
  gameSettingsTree,
} from './game-settings';
import {
  type GameSettingsRowView,
  GameSettingsScreenView,
} from './game-settings-screen-view';

/** What the person may do, for every permission the tree's rows name. */
export function useSettingsPermissions(
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
  backLabel: JSX.Element;
  onBack: () => void;
}): JSX.Element {
  const rows = createMemo((): GameSettingsRowView[] =>
    gameSettingsRows(props.node, props.can).map((row) => ({
      key: row.key,
      title: row.title(),
      caption:
        row.caption === undefined ? undefined : (
          <Dynamic component={row.caption} />
        ),
      icon: row.icon,
      testId: gameSettingsHandle(props.gameId, props.node.place, row.key),
      opens: gameSettingsChild(props.node.place, row.key),
    }))
  );
  const subtitle = (): (() => JSX.Element) | undefined =>
    props.node.opens.kind === 'group' ? props.node.opens.subtitle : undefined;
  return (
    <GameSettingsScreenView
      place={props.node.place}
      title={props.node.row?.title() ?? <SettingsTitle />}
      subtitle={
        subtitle() === undefined ? undefined : (
          <Dynamic component={subtitle()} />
        )
      }
      rows={rows()}
      onOpen={props.onOpen}
      backLabel={props.backLabel}
      onBack={props.onBack}
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
  const opening = createMemo(() => gameSettingsOpening(tree, can));
  // The root stands for the screen the settings open on.
  const node = createMemo(() => {
    const shown = gameSettingsNodeShown(tree, nav.place(), can);
    return shown === tree.root ? opening() : shown;
  });
  // The place Back leads to inside the settings; none from where they open.
  const behindPlace = (): GameSettingsPlace | null =>
    node() === opening() ? null : gameSettingsBehind(tree, node().place);
  const back = (): boolean => {
    const behind = behindPlace();
    if (behind === null) return false;
    nav.open(behind);
    return true;
  };
  // Back's destination by name: the group behind this one, or the menu.
  const behindTitle = (): string | undefined => {
    const behind = behindPlace();
    if (behind === null) return choices();
    return tree.nodes.get(behind.screen)?.row?.title() ?? t`Settings`;
  };
  const behindName = (): JSX.Element =>
    behindTitle() ?? <Trans>the game</Trans>;
  const leave = (): void => {
    if (!back()) props.onBack();
  };
  const load = () => {
    const opens = node().opens;
    return opens.kind === 'catalogue-load' ? opens.load : null;
  };
  return (
    <>
      <DefineBackButton
        onPress={leave}
        label={behindTitle()}
        within={behindPlace() !== null}
      />
      <Switch>
        <Match when={node().opens.kind === 'group'}>
          {/* Keyed by group: each is a screen of its own, so the keyboard
              moves to the next group's title instead of dropping. */}
          <Show when={node().place.screen} keyed>
            <GameSettingsGroup
              gameId={props.gameId}
              node={node()}
              can={can}
              onOpen={nav.open}
              backLabel={behindName()}
              onBack={leave}
            />
          </Show>
        </Match>
        <Match when={load()} keyed>
          {(client) => (
            <CatalogueLoadScreen
              client={client}
              frame={{ kind: 'space', onLeave: leave }}
            />
          )}
        </Match>
      </Switch>
    </>
  );
}
