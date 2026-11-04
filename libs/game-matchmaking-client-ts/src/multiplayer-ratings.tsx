import { isProvisional } from '@libs/game-matchmaking-shared-ts/multiplayer-rating';
import type { MultiplayerRatingPool } from '@libs/game-matchmaking-shared-ts/time-control';
import {
  gameSpeed,
  MULTIPLAYER_SPEEDS,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Plural, Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
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

/** The person's own multiplayer rating and rated games in every pool. */
export function MultiplayerRatings(props: {
  readonly ratings: readonly MultiplayerRatingView[];
}): JSX.Element {
  return (
    <GameSection title={<Trans>Your ratings</Trans>}>
      {/* One game rating takes the row, so its tag sits beside it. */}
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
              tag={
                <Show when={isProvisional(rating)}>
                  <Badge
                    intent="neutral"
                    label={<Trans>Provisional</Trans>}
                    dataSet={{
                      testid: `multiplayer-rating-${rating.pool}-provisional`,
                    }}
                  />
                </Show>
              }
              detail={
                <Text
                  variant="inherit"
                  testId={`multiplayer-rating-${rating.pool}-games`}
                >
                  <Plural
                    value={rating.games}
                    one="# rated game"
                    other="# rated games"
                  />
                </Text>
              }
            />
          )}
        </For>
      </Grid>
    </GameSection>
  );
}
