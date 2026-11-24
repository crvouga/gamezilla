/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import type { SpaceRole } from '../space-types';
import styles from './space-launcher.module.css';
import {
  type SpaceLauncherGame,
  SpaceLauncherTile,
} from './space-launcher-tile';

export {
  type SpaceLauncherGame,
  SpaceLauncherTile,
  useFitWords,
} from './space-launcher-tile';

export type SpaceLauncherProps = {
  /** The host picks; a guest suggests. */
  role: SpaceRole;
  /** The host's name, in a guest's status line and the host's tile. */
  hostName: string;
  /** How many people are in the space, for each game's fit. */
  present: number;
  /** Every game, one tile each, in the order given. */
  games: readonly SpaceLauncherGame[];
  /** A guest sees the tile the host is on (its `key`). */
  lookingAt?: string | undefined;
  /** The host picked a game: open its setup. */
  onChoose?: ((key: string) => void) | undefined;
  /**
   * A guest suggested a game to the host. Unset where guests cannot
   * suggest: their tiles only show, and no line offers it.
   */
  onSuggest?: ((key: string) => void) | undefined;
  /** `data-testid`s for harness bindings. */
  testIds?: { status?: string | undefined } | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function useCopy(props: SpaceLauncherProps) {
  const { t } = useLingui();
  const host = () => props.role === 'host';
  const suggests = () => props.onSuggest !== undefined;
  const choosing = () =>
    props.hostName === ''
      ? t`The host is choosing a game`
      : t`${props.hostName} is choosing a game`;
  const picking = () =>
    props.present === 1
      ? t`Pick a game`
      : t`Pick a game for ${props.present} players`;
  const guestHint = () =>
    suggests()
      ? t`You join when the game starts. Tap a game to suggest it.`
      : t`You join when the game starts.`;
  const guestFoot = () =>
    suggests()
      ? t`Only the host starts a game. Dimmed games don't fit ${props.present} players.`
      : t`Only the host starts a game.`;
  return {
    status: () => (host() ? picking() : choosing()),
    hint: () =>
      host()
        ? t`Tap a game to set it up. Modes and bots come next.`
        : guestHint(),
    section: () => (host() || !suggests() ? t`Games` : t`Suggest a game`),
    foot: () =>
      host() ? t`Guests see which game you're looking at.` : guestFoot(),
  };
}

/**
 * `SpaceLauncher` -- the stage while the host chooses a game: a status
 * line, then a grid of game tiles (four across on a phone), one per game.
 * It looks the same for every game, so it is not a template; modes,
 * variants and head counts live in each game's own setup.
 *
 * Tiles show their fit with the room in words (`Needs 4`, `Solo`); a game
 * too few people are here for is dimmed. With more people than a game
 * seats, the rest watch. The `role` decides the rest:
 *
 * - `host`: tiles are selectable (`onChoose`); a guest's suggestion is
 *   marked on its tile (`ana suggested`); when bots can fill seats the tile
 *   says so (`4 · add 2 bots`).
 * - `guest`: tapping suggests (`onSuggest`); the tile the host is on
 *   (`lookingAt`) is ringed and says `bob is looking`; the guest's own
 *   suggestion reads `You suggested` and is pressed. Without `onSuggest`
 *   a guest's tiles only show.
 */
export function SpaceLauncher(props: SpaceLauncherProps): JSX.Element {
  const copy = useCopy(props);
  const press = (key: string): (() => void) | undefined => {
    const pressed = props.role === 'host' ? props.onChoose : props.onSuggest;
    return pressed === undefined ? undefined : () => pressed(key);
  };
  return (
    <div
      class={styles['stage']}
      {...dataAttrs({ component: 'SpaceLauncher', ...props.dataSet })}
      data-role={props.role}
    >
      <section class={styles['status']}>
        <h2 class="text textTitle" data-testid={props.testIds?.status}>
          {copy.status()}
        </h2>
        <p class={`text textBody ${styles['muted']}`}>{copy.hint()}</p>
      </section>
      <section class={styles['grid']} aria-label={copy.section()}>
        <For each={props.games}>
          {(game) => (
            <SpaceLauncherTile
              game={game}
              role={props.role}
              present={props.present}
              hostName={props.hostName}
              looking={props.role === 'guest' && props.lookingAt === game.key}
              onPress={press(game.key)}
            />
          )}
        </For>
      </section>
      <Show when={props.games.length > 0}>
        <p class={`text textCaption ${styles['foot']}`}>{copy.foot()}</p>
      </Show>
    </div>
  );
}
