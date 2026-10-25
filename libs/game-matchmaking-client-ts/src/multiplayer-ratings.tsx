import { isProvisional } from '@libs/game-matchmaking-shared-ts/multiplayer-rating';
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
import { For, type JSX, Show } from 'solid-js';
import { SpeedName } from './speed-name';
import type { MultiplayerRatingRow } from './use-multiplayer-data';

const NEW_RATING = { rating: 1500, games: 0 };

/** The person's own multiplayer rating and rated games at every speed. */
export function MultiplayerRatings(props: {
  readonly gameId: string;
  readonly ratings: readonly MultiplayerRatingRow[];
}): JSX.Element {
  const rules = useTurnGames();
  const prefix = () =>
    rules.capability(props.gameId, 'matchmaking')?.namespace ?? '';
  const pools = () =>
    rules.capability(props.gameId, 'matchmaking')?.clockChoices === true
      ? MULTIPLAYER_SPEEDS
      : (['game'] as const);
  const ratingOf = (speed: MultiplayerRatingPool) =>
    props.ratings.find((row) => row.speed === gameSpeed(prefix(), speed)) ??
    NEW_RATING;
  return (
    <GameSection title={<Trans>Your ratings</Trans>}>
      <Grid columns={2} gap="lg">
        <For each={pools()}>
          {(speed) => (
            <GameStat
              dataSet={{ testid: `multiplayer-rating-${speed}` }}
              label={
                <Show
                  when={speed === 'game'}
                  fallback={<SpeedName speed={speed} />}
                >
                  <Trans>Game rating</Trans>
                </Show>
              }
              value={
                <Text
                  variant="inherit"
                  testId={`multiplayer-rating-${speed}-value`}
                >
                  {ratingOf(speed).rating}
                  {isProvisional(ratingOf(speed)) ? '?' : ''}
                </Text>
              }
              detail={
                <Text
                  variant="inherit"
                  testId={`multiplayer-rating-${speed}-games`}
                >
                  <Plural
                    value={ratingOf(speed).games}
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
