import { timeControlOf } from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameFact, GameFacts } from '@pkgs/ui-root-client-ts/game-facts';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';
import {
  MultiplayerRatingFigure,
  type MultiplayerRatingView,
} from './multiplayer-ratings';
import { SpeedName } from './speed-name';
import { timeControlChoiceText, timeControlText } from './time-control-name';

/** What a new search is for. */
export type MultiplayerFindChoice = {
  /** How many players a game seats, the person included. */
  readonly players: number;
  /** The game offers clock choices. */
  readonly timed: boolean;
  /** The time control this device chose for its next search. */
  readonly timeControl: string;
};

type FindProps = MultiplayerPlaceFrame & {
  readonly title: string;
  readonly find: MultiplayerFindChoice;
  readonly ratings: readonly MultiplayerRatingView[];
  readonly onOpen: (place: MultiplayerPlace) => void;
  /** Starts a search, at the chosen time control when the game is timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
};

/**
 * What the search will find, right above its command, as the game's
 * settings line (`Rated · Untimed`, or `Rated · 5+0` at the chosen time
 * control), in the same words and quiet style a game's title carries. A
 * search is always rated.
 */
function MatchConditions(props: {
  readonly find: MultiplayerFindChoice;
}): JSX.Element {
  return (
    <GameFacts testId="multiplayer-find-conditions">
      <GameFact label={<Trans>Rated</Trans>} />
      <GameFact
        label={
          <Show when={props.find.timed} fallback={<Trans>Untimed</Trans>}>
            {timeControlText(props.find.timeControl)}
          </Show>
        }
      />
    </GameFacts>
  );
}

/** How many players a bigger game finds; a two-player search needs no more said. */
function PlayersNeeded(props: {
  readonly find: MultiplayerFindChoice;
}): JSX.Element {
  const count = () => props.find.players;
  return (
    <Show
      when={props.find.timed}
      fallback={
        <Trans>
          A game needs {count()} players including you. Find {count() - 1} other
          players.
        </Trans>
      }
    >
      <Trans>
        A game needs {count()} players including you. Find {count() - 1} other
        players at the same clock choice.
      </Trans>
    </Show>
  );
}

/**
 * The rating a search at the chosen time control plays for: the game's one
 * rating, or the one of that time control's speed.
 */
function ratingAtStake(props: FindProps): MultiplayerRatingView | undefined {
  if (!props.find.timed) return props.ratings[0];
  const speed = timeControlOf(props.find.timeControl)?.speed;
  return props.ratings.find((rating) => rating.pool === speed);
}

/** Where the search's choices and what stands behind it are: one row each. */
function FindRows(props: FindProps): JSX.Element {
  return (
    <MenuSection title={<Trans>New game</Trans>}>
      <Show when={props.find.timed}>
        <MenuRow
          title={<Trans>Time control</Trans>}
          caption={
            <SpeedName
              speed={timeControlOf(props.find.timeControl)?.speed ?? ''}
            />
          }
          value={timeControlChoiceText(props.find.timeControl)}
          onClick={() => props.onOpen({ screen: 'time-control' })}
          dataSet={{
            testid: 'multiplayer-open-time-control',
            'time-control': props.find.timeControl,
          }}
        />
      </Show>
      <MenuRow
        title={<Trans>Your ratings</Trans>}
        value={
          <Show when={ratingAtStake(props)}>
            {(rating) => <MultiplayerRatingFigure rating={rating()} />}
          </Show>
        }
        onClick={() => props.onOpen({ screen: 'ratings', from: 'find' })}
        dataSet={{ testid: 'multiplayer-open-ratings' }}
      />
      <MenuRow
        title={<Trans>How it works</Trans>}
        onClick={() => props.onOpen({ screen: 'guide' })}
        dataSet={{ testid: 'multiplayer-open-guide' }}
      />
    </MenuSection>
  );
}

/**
 * Finding an opponent, or the other players of a bigger game: one row per
 * thing a person may want to look at first (the clock, their ratings, how
 * a search works), what the search will find, and its one command.
 */
export function MultiplayerFindView(props: FindProps): JSX.Element {
  const many = () => props.find.players > 2;
  return (
    <MultiplayerMenuPlace
      {...props}
      title={props.title}
      subtitle={many() ? <PlayersNeeded find={props.find} /> : undefined}
    >
      <FindRows {...props} />
      <StackVertical gap="sm">
        <MatchConditions find={props.find} />
        <GameActionButton
          title={
            <Show when={many()} fallback={<Trans>Find an opponent</Trans>}>
              <Trans>Find players</Trans>
            </Show>
          }
          successLabel={
            <Show
              when={many()}
              fallback={<Trans>Opponent search accepted</Trans>}
            >
              <Trans>Player search accepted</Trans>
            </Show>
          }
          operation={() =>
            props.onFind(props.find.timed ? props.find.timeControl : undefined)
          }
          variant="solid"
          fullWidth
          dataSet={{ testid: 'multiplayer-find' }}
        />
        <P variant="caption" tone="secondary" testId="multiplayer-find-space">
          <Trans>
            The game opens in this space, where everyone can watch. Your
            opponent plays from their own space.
          </Trans>
        </P>
      </StackVertical>
    </MultiplayerMenuPlace>
  );
}
