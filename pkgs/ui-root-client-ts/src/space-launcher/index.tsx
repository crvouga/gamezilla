/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { type SpaceGameFit, spaceGameFit } from '../space-game-fit';
import type { SpaceRole } from '../space-types';
import { Spinner } from '../spinner/index';
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
      ? t`You'll join as soon as it starts. Tap a game to suggest it.`
      : t`You'll join as soon as it starts.`;
  const guestFoot = () =>
    suggests()
      ? t`Only the host starts a game. Dimmed games don't fit ${props.present} players.`
      : t`Only the host starts a game.`;
  return {
    status: () => (host() ? picking() : choosing()),
    hint: () =>
      host()
        ? t`Choose one to set it up. You'll pick its mode and any bots next.`
        : guestHint(),
    section: () => (host() || !suggests() ? t`Games` : t`Suggest a game`),
    foot: () =>
      host()
        ? t`Everyone here sees which game you're looking at.`
        : guestFoot(),
  };
}

/** Where a fit sorts: games everyone here can play lead, short ones last. */
const FIT_ORDER: Readonly<Record<SpaceGameFit['kind'], number>> = {
  fits: 0,
  bots: 1,
  tooMany: 2,
  solo: 3,
  needs: 4,
};

/**
 * The games in the order a group reads them: those that seat everyone here
 * first (with bots next), then those where some watch, then those too few
 * are here for. The given order holds within each.
 */
function orderedGames(
  games: readonly SpaceLauncherGame[],
  present: number,
  viewer: SpaceRole
): SpaceLauncherGame[] {
  const rank = (game: SpaceLauncherGame): number =>
    FIT_ORDER[spaceGameFit(game.players, present, viewer).kind];
  return [...games].sort((a, b) => rank(a) - rank(b));
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
        {/* A guest is waiting on the host: the one activity indicator says
            so beside the words, so their screen reads as a wait, not a menu. */}
        <p class={`text textBody ${styles['muted']} ${styles['hint']}`}>
          <Show when={props.role === 'guest'}>
            <Spinner size="sm" decorative />
          </Show>
          <span>{copy.hint()}</span>
        </p>
      </section>
      <section class={styles['games']} aria-label={copy.section()}>
        <div class={styles['grid']}>
          <For
            each={orderedGames(
              props.games,
              props.present,
              // A guest who cannot suggest reads every game as the host does.
              props.role === 'guest' && props.onSuggest === undefined
                ? 'host'
                : props.role
            )}
          >
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
        </div>
        {/* What the choice means, right under the games it is about. */}
        <Show when={props.games.length > 0}>
          <p class={`text textCaption ${styles['foot']}`}>{copy.foot()}</p>
        </Show>
      </section>
    </div>
  );
}
