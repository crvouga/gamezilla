import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { isProvisional } from '@libs/chess-matchmaking-shared/multiplayer-rating';
import { MULTIPLAYER_SPEEDS } from '@libs/chess-matchmaking-shared/time-control';
import { Plural, Trans } from '@lingui/solid/macro';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { GameStat } from '@pkgs/ui-root-client/game-stat';
import { For, type JSX, Show } from 'solid-js';
import { moveListText } from './multiplayer-format';
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
    <GameSection title={<Trans>Your ratings</Trans>}>
      <div class="grid grid-cols-2 gap-x-4 gap-y-5">
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

/** The accepted moves of the game, in algebraic notation. */
export function MultiplayerMoves(props: {
  readonly game: MultiplayerGame;
}): JSX.Element {
  const moves = () => moveListText(props.game);
  return (
    <GameSection title={<Trans>Moves</Trans>}>
      <p
        class="text textBody textNumeral break-words"
        data-testid="multiplayer-move-list"
      >
        {moves()}
      </p>
      <Show when={moves() === ''}>
        <p class="text textCaption">
          <Trans>No moves yet.</Trans>
        </p>
      </Show>
    </GameSection>
  );
}
