import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX, Show } from 'solid-js';
import type { GameSettingsPlace } from './game-settings';

/** One row of a settings group: how it reads and the place it opens. */
export type GameSettingsRowView = {
  readonly key: string;
  readonly title: JSX.Element;
  readonly caption?: JSX.Element | undefined;
  /** The control's handle (`<game>-<group>-<row>`). */
  readonly testId: string;
  readonly opens: GameSettingsPlace;
};

export type GameSettingsScreenViewProps = {
  /** The group shown: the settings' root, or one a row opened. */
  readonly place: GameSettingsPlace;
  /** The group's name: "Settings" for the root, else its row's title. */
  readonly title: JSX.Element;
  /** One line under the name. */
  readonly subtitle?: JSX.Element | undefined;
  /** The rows the person may see, in the order the game declared. */
  readonly rows: readonly GameSettingsRowView[];
  readonly onOpen: (place: GameSettingsPlace) => void;
  /** Where Back leads: the group behind this one, or the game's menu. */
  readonly backLabel: JSX.Element;
  readonly onBack: () => void;
};

/**
 * One group of a game's settings, presentational: a hub of the rows the
 * game declared as data, each leading onward to a nested group or one of
 * the platform's template screens, its title whole however long. A group
 * none of whose rows the person may see says so, with a button back to
 * where they came from, instead of standing blank. `GameSettingsScreen`
 * reads the game's tree, hides rows by permission and keeps the place.
 */
export function GameSettingsScreenView(
  props: GameSettingsScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="game-settings"
      title={props.title}
      subtitle={props.subtitle}
      dataSet={{ testid: 'game-settings', place: props.place.screen }}
    >
      <Show
        when={props.rows.length > 0}
        fallback={
          <EmptyState
            variant="compact"
            role="status"
            title={<Trans>Nothing to change here</Trans>}
            body={
              <Trans>
                These settings are for the people who manage this game's
                content. Everything else in the game works as usual.
              </Trans>
            }
            action={{
              label: <Trans>Back to {props.backLabel}</Trans>,
              onClick: props.onBack,
            }}
            dataSet={{ testid: 'game-settings-empty' }}
          />
        }
      >
        <MenuSection>
          <For each={props.rows}>
            {(row) => (
              <MenuRow
                title={row.title}
                titleLines={2}
                caption={row.caption}
                onClick={() => props.onOpen(row.opens)}
                dataSet={{ testid: row.testId }}
              />
            )}
          </For>
        </MenuSection>
      </Show>
    </EmbeddedScreen>
  );
}
