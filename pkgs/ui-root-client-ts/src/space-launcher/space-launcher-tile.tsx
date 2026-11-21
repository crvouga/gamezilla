/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';
import { Badge } from '../badge/index';
import { GameTile } from '../game-tile/index';
import {
  type SpaceGameFit,
  spaceGameFit,
  spaceGameFitDimmed,
} from '../space-game-fit';
import type { SpaceGame, SpaceRole } from '../space-types';
import styles from './space-launcher.module.css';

/** One game in the launcher: the game's data and who suggested it. */
export type SpaceLauncherGame = Pick<
  SpaceGame,
  'key' | 'name' | 'motif' | 'players'
> & {
  /** Who suggested this game to the host. */
  suggestedBy?: { name: string; you?: boolean | undefined } | undefined;
};

/** The fit of a game in words: `2–4 players`, `Needs 4`, `4 · add 2 bots`. */
export function useFitWords(): (fit: SpaceGameFit) => string {
  const { t } = useLingui();
  const counts = (values: readonly number[]): string => {
    const first = values[0] ?? 1;
    const last = values.at(-1) ?? first;
    if (values.length === 1) {
      return first === 1 ? t`Solo` : t`${first} players`;
    }
    if (last - first === values.length - 1) return t`${first}–${last} players`;
    return t`${values.join(', ')} players`;
  };
  return (fit) => {
    if (fit.kind === 'fits') return counts(fit.counts);
    if (fit.kind === 'solo') return t`Solo`;
    if (fit.kind === 'tooMany') return t`Up to ${fit.max}`;
    if (fit.kind === 'needs') return t`Needs ${fit.target}`;
    return fit.bots === 1
      ? t`${fit.target} · add 1 bot`
      : t`${fit.target} · add ${fit.bots} bots`;
  };
}

function TileMark(props: {
  game: SpaceLauncherGame;
  fit: SpaceGameFit;
  looking: boolean;
  hostName: string;
}): JSX.Element {
  const { t } = useLingui();
  const fitWords = useFitWords();
  return (
    <Switch
      fallback={
        <span class={`text textCaption ${styles['fit']}`}>
          {fitWords(props.fit)}
        </span>
      }
    >
      <Match when={props.looking}>
        <span class={`text textLabel ${styles['looking']}`}>
          {t`${props.hostName} is looking`}
        </span>
      </Match>
      <Match when={props.game.suggestedBy}>
        {(by) => (
          <Badge
            size="sm"
            intent="brand"
            tone="subtle"
            label={
              by().you === true ? t`You suggested` : t`${by().name} suggested`
            }
          />
        )}
      </Match>
    </Switch>
  );
}

/**
 * One launcher tile: the game's art, its name and one line under it (its
 * fit with the room, a suggestion, or where the host is). A game that does
 * not fit is dimmed, says why, and cannot be picked.
 */
export function SpaceLauncherTile(props: {
  game: SpaceLauncherGame;
  role: SpaceRole;
  present: number;
  hostName: string;
  /** The host is on this tile (shown to a guest). */
  looking: boolean;
  onPress: () => void;
}): JSX.Element {
  const fit = () => spaceGameFit(props.game.players, props.present, props.role);
  const dimmed = () => spaceGameFitDimmed(fit());
  const suggestedByYou = () => props.game.suggestedBy?.you === true;
  return (
    <button
      type="button"
      class={styles['tile']}
      data-game={props.game.key}
      data-dimmed={dimmed()}
      data-looking={props.looking}
      aria-disabled={dimmed() ? 'true' : undefined}
      aria-pressed={props.role === 'guest' ? suggestedByYou() : undefined}
      onClick={() => {
        if (!dimmed()) props.onPress();
      }}
    >
      <span class={styles['art']}>
        <GameTile motif={props.game.motif} size="lg" />
      </span>
      <span class={`text textLabel ${styles['name']}`}>{props.game.name}</span>
      <TileMark
        game={props.game}
        fit={fit()}
        looking={props.looking}
        hostName={props.hostName}
      />
    </button>
  );
}
