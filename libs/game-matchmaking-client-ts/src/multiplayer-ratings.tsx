import {
  isProvisional,
  MULTIPLAYER_SETTLED_GAMES,
} from '@libs/game-matchmaking-shared-ts/multiplayer-rating';
import type { MultiplayerRatingPool } from '@libs/game-matchmaking-shared-ts/time-control';
import {
  gameSpeed,
  MULTIPLAYER_SPEEDS,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Plural, Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { SpeedName } from './speed-name';
import type { MultiplayerRatingRow } from './use-multiplayer-data';

/** The person's rating in one pool: one game rating, or one per speed. */
export type MultiplayerRatingView = {
  readonly pool: MultiplayerRatingPool | 'game';
  readonly rating: number;
  readonly games: number;
};

const NEW_RATING = { rating: 1500, games: 0 };

/**
 * The person's own rating in every pool the game rates: one per speed for
 * a game with clock choices, else one game rating; a pool never played is
 * the starting rating.
 */
export function useMultiplayerRatings(
  gameId: Accessor<string>,
  rows: Accessor<readonly MultiplayerRatingRow[]>
): Accessor<readonly MultiplayerRatingView[]> {
  const rules = useTurnGames();
  return createMemo(() => {
    const matchmaking = rules.capability(gameId(), 'matchmaking');
    const prefix = matchmaking?.namespace ?? '';
    const pools: readonly (MultiplayerRatingPool | 'game')[] =
      matchmaking?.clockChoices === true ? MULTIPLAYER_SPEEDS : ['game'];
    return pools.map((pool) => {
      const row =
        rows().find(
          (candidate) => candidate.speed === gameSpeed(prefix, pool)
        ) ?? NEW_RATING;
      return { pool, rating: row.rating, games: row.games };
    });
  });
}

/**
 * A rating as people read it: the number, and beside it the quiet "?" a
 * provisional rating keeps until it settles, so it never reads as an error.
 */
export function MultiplayerRatingFigure(props: {
  readonly rating: MultiplayerRatingView;
}): JSX.Element {
  return (
    <>
      {props.rating.rating}
      <Show when={isProvisional(props.rating)}>
        <Text variant="inherit" tone="secondary">
          ?
        </Text>
      </Show>
    </>
  );
}

/** The pool a rating belongs to, in words: a speed, or the game's one rating. */
export function MultiplayerRatingPoolName(props: {
  readonly pool: MultiplayerRatingView['pool'];
}): JSX.Element {
  return (
    <Show
      when={props.pool === 'game'}
      fallback={<SpeedName speed={props.pool} />}
    >
      <Trans>Game rating</Trans>
    </Show>
  );
}

/**
 * How many rated games stand behind a rating and, while it is provisional,
 * how many of the games that settle it are played (`7 of 12 rated games`)
 * and, once, what the "?" beside the number means, in plain words.
 */
export function MultiplayerRatingGames(props: {
  readonly rating: MultiplayerRatingView;
}): JSX.Element {
  return (
    <>
      <Text
        variant="inherit"
        testId={`multiplayer-rating-${props.rating.pool}-games`}
      >
        <Show
          when={isProvisional(props.rating)}
          fallback={
            <Plural
              value={props.rating.games}
              one="# rated game"
              other="# rated games"
            />
          }
        >
          <Trans>
            {props.rating.games} of {MULTIPLAYER_SETTLED_GAMES} rated games
          </Trans>
        </Show>
      </Text>
      <Show when={isProvisional(props.rating)}>
        {' · '}
        <Text
          variant="inherit"
          testId={`multiplayer-rating-${props.rating.pool}-settles`}
        >
          <Trans>the “?” goes once your rating settles</Trans>
        </Text>
      </Show>
    </>
  );
}
