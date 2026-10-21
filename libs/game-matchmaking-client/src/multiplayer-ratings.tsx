import { isProvisional } from '@libs/game-matchmaking-shared/multiplayer-rating';
import type { MultiplayerSpeed } from '@libs/game-matchmaking-shared/time-control';
import {
  gameSpeed,
  MULTIPLAYER_SPEEDS,
} from '@libs/game-matchmaking-shared/time-control';
import { Plural, Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { GameStat } from '@pkgs/ui-root-client/game-stat';
import { Grid } from '@pkgs/ui-root-client/grid';
import { Text } from '@pkgs/ui-root-client/text';
import { For, type JSX } from 'solid-js';
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
    rules.capability(props.gameId, 'matchmaking')?.clockNamespace ?? '';
  const ratingOf = (speed: MultiplayerSpeed) =>
    props.ratings.find((row) => row.speed === gameSpeed(prefix(), speed)) ??
    NEW_RATING;
  return (
    <GameSection title={<Trans>Your ratings</Trans>}>
      <Grid columns={2} gap="lg">
        <For each={MULTIPLAYER_SPEEDS}>
          {(speed) => (
            <GameStat
              dataSet={{ testid: `multiplayer-rating-${speed}` }}
              label={<SpeedName speed={speed} />}
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
