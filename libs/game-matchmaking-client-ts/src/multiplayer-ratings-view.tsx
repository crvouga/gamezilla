import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import {
  MultiplayerRatingFigure,
  MultiplayerRatingGames,
  MultiplayerRatingPoolName,
  type MultiplayerRatingView,
} from './multiplayer-ratings';

/**
 * The person's own multiplayer rating in every pool the game rates: one
 * row per speed, or the game's one rating. Each row is the number, with
 * its quiet "?" while provisional, over how many rated games stand behind
 * it. Nothing here is pressed: the ratings are read, then Back.
 */
export function MultiplayerRatingsView(
  props: MultiplayerPlaceFrame & {
    readonly ratings: readonly MultiplayerRatingView[];
  }
): JSX.Element {
  return (
    <MultiplayerMenuPlace {...props} title={<Trans>Your ratings</Trans>}>
      <MenuSection
        footer={
          <Trans>
            Every matched game is rated. A rating moves once when its game ends.
          </Trans>
        }
      >
        <For each={props.ratings}>
          {(rating) => (
            <MenuRow
              title={<MultiplayerRatingPoolName pool={rating.pool} />}
              caption={<MultiplayerRatingGames rating={rating} />}
              value={
                <Text
                  variant="inherit"
                  numeral
                  testId={`multiplayer-rating-${rating.pool}-value`}
                >
                  <MultiplayerRatingFigure rating={rating} />
                </Text>
              }
              dataSet={{ testid: `multiplayer-rating-${rating.pool}` }}
            />
          )}
        </For>
      </MenuSection>
    </MultiplayerMenuPlace>
  );
}
