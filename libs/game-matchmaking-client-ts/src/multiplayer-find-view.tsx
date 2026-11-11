import { timeControlOf } from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GameLobbyDock,
  GameModeCard,
  type GameModeFact,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import {
  MultiplayerLobbyPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';
import {
  MultiplayerRatingFigure,
  type MultiplayerRatingView,
} from './multiplayer-ratings';
import { SpeedName } from './speed-name';
import { timeControlWords } from './time-control-name';

/** What a new search is for. */
export type MultiplayerFindChoice = {
  /** How many players a game seats, the person included. */
  readonly players: number;
  /** The game offers clock choices. */
  readonly timed: boolean;
  /** The time control this device chose for its next search. */
  readonly timeControl: string;
  /**
   * Nothing was ever sought from this space, so there is no game here to
   * return to or watch: the hub says so before offering the first search.
   */
  readonly fresh?: boolean | undefined;
};

type FindProps = MultiplayerPlaceFrame & {
  readonly title: string;
  /** How the game is won, in one sentence, where the game says. */
  readonly goal?: string | undefined;
  readonly find: MultiplayerFindChoice;
  readonly ratings: readonly MultiplayerRatingView[];
  readonly onOpen: (place: MultiplayerPlace) => void;
  /** Starts a search, at the chosen time control when the game is timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
};

/**
 * What the search will find, as the mode card's tiles: how many play, the
 * clock at the chosen time control in plain words, and that it is rated (a
 * search always is).
 */
function conditions(find: MultiplayerFindChoice): readonly GameModeFact[] {
  return [
    {
      id: 'players',
      label: <Trans>Players</Trans>,
      value: find.players,
    },
    {
      id: 'clock',
      label: <Trans>Clock</Trans>,
      value: find.timed ? (
        timeControlWords(find.timeControl)
      ) : (
        <Trans>Untimed</Trans>
      ),
      testId: 'multiplayer-find-clock',
    },
    {
      id: 'rating',
      label: <Trans>Rating</Trans>,
      value: <Trans>Rated</Trans>,
      testId: 'multiplayer-find-rated',
    },
  ];
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
          value={timeControlWords(props.find.timeControl)}
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

/** The search's one command, held at the foot of the screen. */
function FindDock(props: FindProps): JSX.Element {
  const many = () => props.find.players > 2;
  return (
    <GameLobbyDock
      status={
        <P variant="caption" tone="secondary" testId="multiplayer-find-space">
          <Trans>
            The game opens in this space, where everyone can watch. Your
            opponent plays from their own space.
          </Trans>
        </P>
      }
    >
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
        size="lg"
        fullWidth
        dataSet={{ testid: 'multiplayer-find' }}
      />
    </GameLobbyDock>
  );
}

/**
 * Finding an opponent, or the other players of a bigger game: what will be
 * played (the game, how it is won, how many play, the clock, rated), one
 * row per thing a person may want to look at first (the clock, their
 * ratings, how a search works), and the search's one command in a dock at
 * the foot of the screen.
 */
export function MultiplayerFindView(props: FindProps): JSX.Element {
  return (
    <MultiplayerLobbyPlace {...props} dock={<FindDock {...props} />}>
      <GameModeCard
        eyebrow={<Trans>Ranked match</Trans>}
        title={props.title}
        summary={props.goal}
        facts={conditions(props.find)}
        dataSet={{ testid: 'multiplayer-find-conditions' }}
      />
      <Show when={props.find.players > 2}>
        <P variant="caption" tone="secondary" testId="multiplayer-find-players">
          <PlayersNeeded find={props.find} />
        </P>
      </Show>
      <Show when={props.find.fresh === true}>
        <Notice dataSet={{ testid: 'multiplayer-unavailable' }}>
          <Text variant="inherit" role="status">
            <Trans>
              No multiplayer game is available to you. Find an opponent to start
              one.
            </Trans>
          </Text>
        </Notice>
      </Show>
      <FindRows {...props} />
    </MultiplayerLobbyPlace>
  );
}
