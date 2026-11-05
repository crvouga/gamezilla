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
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameStat } from '@pkgs/ui-root-client-ts/game-stat';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
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
 * Under the number, one quiet footnote: how many rated games stand behind
 * it and, while it is provisional, how many of the games that settle it
 * are played (`7 of 12 rated games`) and what the "?" beside the number
 * means, in plain words. No bar: the rating supports finding an opponent,
 * it never competes with it.
 */
function RatingGames(props: {
  readonly rating: MultiplayerRatingView;
}): JSX.Element {
  return (
    <>
      <RatingGameCount rating={props.rating} />
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

function RatingGameCount(props: {
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
          {props.rating.games} of {MULTIPLAYER_SETTLED_GAMES} rated games
        </Trans>
      </Show>
    </Text>
  );
}

/** One pool's rating: the number, its quiet "Provisional" tag and how far it is from settling. */
function RatingStat(props: {
  readonly rating: MultiplayerRatingView;
}): JSX.Element {
  const provisional = (): boolean => isProvisional(props.rating);
  return (
    <GameStat
      dataSet={{ testid: `multiplayer-rating-${props.rating.pool}` }}
      label={
        <Show
          when={props.rating.pool === 'game'}
          fallback={<SpeedName speed={props.rating.pool} />}
        >
          <Trans>Game rating</Trans>
        </Show>
      }
      value={
        <Text
          variant="inherit"
          testId={`multiplayer-rating-${props.rating.pool}-value`}
        >
          {props.rating.rating}
          {/* The "?" a provisional rating keeps is quiet beside the number,
              the tag after it saying what it means, so it never reads as
              an error. */}
          <Show when={provisional()}>
            <Text variant="inherit" tone="secondary">
              ?
            </Text>
          </Show>
        </Text>
      }
      tag={
        <Show when={provisional()}>
          <Badge
            intent="neutral"
            label={<Trans>Provisional</Trans>}
            dataSet={{
              testid: `multiplayer-rating-${props.rating.pool}-provisional`,
            }}
          />
        </Show>
      }
      detail={<RatingGames rating={props.rating} />}
    />
  );
}

/** Every pool's rating: one takes the row; a rating per speed, two a row. */
function RatingGrid(props: {
  readonly ratings: readonly MultiplayerRatingView[];
}): JSX.Element {
  return (
    <Grid columns={props.ratings.length === 1 ? 1 : 2} gap="lg">
      <For each={props.ratings}>
        {(rating) => <RatingStat rating={rating} />}
      </For>
    </Grid>
  );
}

/**
 * The person's own multiplayer rating and rated games in every pool. A
 * provisional rating keeps its "?" and says so in a tag, with how many of
 * the games that settle it are played. `framed={false}` draws it without
 * a card of its own, under a heading, for the search's card to hold.
 */
export function MultiplayerRatings(props: {
  readonly ratings: readonly MultiplayerRatingView[];
  readonly framed?: boolean | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.framed !== false}
      fallback={
        <StackVertical gap="md">
          <H3 size="label">
            <Trans>Your ratings</Trans>
          </H3>
          <RatingGrid ratings={props.ratings} />
        </StackVertical>
      }
    >
      <GameSection title={<Trans>Your ratings</Trans>}>
        <RatingGrid ratings={props.ratings} />
      </GameSection>
    </Show>
  );
}
