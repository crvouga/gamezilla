import { isProvisional } from '@libs/chess-matchmaking-shared/multiplayer-rating';
import { MULTIPLAYER_SPEEDS } from '@libs/chess-matchmaking-shared/time-control';
import { t } from '@lingui/core/macro';
import { Plural } from '@lingui/solid/macro';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { GameStat } from '@pkgs/ui-root-client/game-stat';
import { For, type JSX } from 'solid-js';
import { SpeedName } from './speed-name';
import type { MultiplayerRatingRow } from './use-multiplayer-data';

const NEW_RATING = { rating: 1500, games: 0 };

/** The person's own multiplayer rating and rated games at every speed. */
export function MultiplayerRatings(props: {
  readonly ratings: readonly MultiplayerRatingRow[];
}): JSX.Element {
  const ratingOf = (speed: string) =>
    props.ratings.find((row) => row.speed === speed) ?? NEW_RATING;
  return (
    <GameSection title={t`Your multiplayer ratings`}>
      <div class="grid grid-cols-2 gap-2">
        <For each={MULTIPLAYER_SPEEDS}>
          {(speed) => (
            <GameStat
              dataSet={{ testid: `multiplayer-rating-${speed}` }}
              label={<SpeedName speed={speed} />}
              value={
                <span data-testid={`multiplayer-rating-${speed}-value`}>
                  {ratingOf(speed).rating}
                  {isProvisional(ratingOf(speed)) ? '?' : ''}
                </span>
              }
              detail={
                <span data-testid={`multiplayer-rating-${speed}-games`}>
                  <Plural
                    value={ratingOf(speed).games}
                    one="# rated game"
                    other="# rated games"
                  />
                </span>
              }
            />
          )}
        </For>
      </div>
    </GameSection>
  );
}
