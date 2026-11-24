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
  /** The tile's `data-testid`, for harness bindings. */
  testId?: string | undefined;
};

/** The fit of a game in words: `2–4 players`, `Needs 4`, `4 · add 2 bots`. */
export function useFitWords(): (fit: SpaceGameFit, present?: number) => string {
  const { t } = useLingui();
  const counts = (values: readonly number[]): string => {
    const first = values[0] ?? 1;
    const last = values.at(-1) ?? first;
    if (values.length === 1) {
      return first === 1 ? t`Solo` : t`${first} players`;
    }
    if (last - first === values.length - 1) return t`${first}–${last} players`;
    if (values.length === 2) return t`${first} or ${last}`;
    return t`${values.join(', ')} players`;
  };
  // With the head count, a game that seats fewer says who sits out.
  const watch = (n: number): string => t`${n} watching`;
  return (fit, present) => {
    if (fit.kind === 'fits') return counts(fit.counts);
    if (fit.kind === 'solo')
      return present === undefined || present < 2
        ? t`Solo`
        : t`Solo · ${watch(present - 1)}`;
    if (fit.kind === 'tooMany')
      return present === undefined
        ? t`Up to ${fit.max}`
        : t`${fit.max} players · ${watch(present - fit.max)}`;
    if (fit.kind === 'needs') return t`Needs ${fit.target}`;
    return fit.bots === 1
      ? t`${fit.target} players · 1 bot`
      : t`${fit.target} players · ${fit.bots} bots`;
  };
}

function TileMark(props: {
  game: SpaceLauncherGame;
  fit: SpaceGameFit;
  present: number;
  looking: boolean;
  hostName: string;
}): JSX.Element {
  const { t } = useLingui();
  const fitWords = useFitWords();
  return (
    <Switch
      fallback={
        <span class={`text textCaption ${styles['fit']}`}>
          {fitWords(props.fit, props.present)}
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
 * fit with the room, a suggestion, or where the host is). A game too few
 * people are here for is dimmed and says why. The host can still pick it
 * (its own choices find or invite the players); a guest cannot suggest it.
 */
export function SpaceLauncherTile(props: {
  game: SpaceLauncherGame;
  role: SpaceRole;
  present: number;
  hostName: string;
  /** The host is on this tile (shown to a guest). */
  looking: boolean;
  /** Pressing does something for this viewer: unset, the tile only shows. */
  onPress: (() => void) | undefined;
}): JSX.Element {
  // A guest who cannot suggest only watches the host choose: every game
  // reads as the host sees it, none dimmed, none looking pressable.
  const watching = () => props.role === 'guest' && props.onPress === undefined;
  const fit = () =>
    spaceGameFit(
      props.game.players,
      props.present,
      watching() ? 'host' : props.role
    );
  const dimmed = () => !watching() && spaceGameFitDimmed(fit());
  const suggestedByYou = () => props.game.suggestedBy?.you === true;
  const press = () => {
    if (props.role === 'guest' && dimmed()) return undefined;
    return props.onPress;
  };
  return (
    <button
      type="button"
      class={styles['tile']}
      data-game={props.game.key}
      data-testid={props.game.testId}
      data-dimmed={dimmed()}
      data-looking={props.looking}
      aria-disabled={press() === undefined ? 'true' : undefined}
      aria-pressed={props.role === 'guest' ? suggestedByYou() : undefined}
      onClick={() => press()?.()}
    >
      <span class={styles['art']}>
        <GameTile motif={props.game.motif} size="xl" />
      </span>
      <span class={`text textBodyBold ${styles['name']}`}>
        {props.game.name}
      </span>
      <TileMark
        game={props.game}
        fit={fit()}
        present={props.present}
        looking={props.looking}
        hostName={props.hostName}
      />
    </button>
  );
}
