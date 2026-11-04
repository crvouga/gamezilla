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
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameStat } from '@pkgs/ui-root-client-ts/game-stat';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
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
 * Under the number, in one compact line: how many rated games stand
 * behind it and, while the "?" marks it provisional, how many settle it
 * (`Provisional · 7 of 12 rated games`).
 */
function RatingGames(props: {
  readonly rating: MultiplayerRatingView;
}): JSX.Element {
  return (
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
          Provisional · {props.rating.games} of {MULTIPLAYER_SETTLED_GAMES}{' '}
          rated games
        </Trans>
      </Show>
    </Text>
  );
}

/**
 * The person's own multiplayer rating and rated games in every pool. With
 * `fill` (beside the search, nothing else in the rail) it ends level with
 * the search's panel.
 */
export function MultiplayerRatings(props: {
  readonly ratings: readonly MultiplayerRatingView[];
  readonly fill?: boolean | undefined;
}): JSX.Element {
  return (
    <GameSection title={<Trans>Your ratings</Trans>} fill={props.fill}>
      {/* One game rating takes the row; a rating per speed, two a row. */}
      <Grid columns={props.ratings.length === 1 ? 1 : 2} gap="lg">
        <For each={props.ratings}>
          {(rating) => (
            <GameStat
              dataSet={{ testid: `multiplayer-rating-${rating.pool}` }}
              label={
                <Show
                  when={rating.pool === 'game'}
                  fallback={<SpeedName speed={rating.pool} />}
                >
                  <Trans>Game rating</Trans>
                </Show>
              }
              value={
                <Text
                  variant="inherit"
                  testId={`multiplayer-rating-${rating.pool}-value`}
                >
                  {rating.rating}
                  {isProvisional(rating) ? '?' : ''}
                </Text>
              }
              detail={<RatingGames rating={rating} />}
            />
          )}
        </For>
      </Grid>
    </GameSection>
  );
}
