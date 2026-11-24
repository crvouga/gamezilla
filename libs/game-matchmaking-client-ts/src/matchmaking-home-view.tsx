import { timeControlOf } from '@libs/game-matchmaking-shared-ts/time-control';
import { Plural, Trans } from '@lingui/solid/macro';
import { ActionNotice } from '@pkgs/ui-root-client-ts/action-notice';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GameLobbyDock,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { ClockIcon, GaugeIcon, InfoIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
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
import { ReturnOffer } from './return-to-game-offer';
import { SpeedName } from './speed-name';
import { timeControlWords } from './time-control-name';
import type { UnfinishedGame } from './use-unfinished-game';

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
  /**
   * Searching is refused for now (a guest's daily games are used up): the
   * notice says why and how to go on, and the command waits, held back.
   */
  readonly findRefused?: boolean | undefined;
  /**
   * No connection: said on the dock's status line, right over the held
   * command it explains, never in a card that can be dismissed.
   */
  readonly offline?: boolean | undefined;
  /**
   * The way past a refusal (Sign in, once a guest's games are used): it
   * takes the dock's place, the one filled command, instead of a Find
   * that cannot be pressed.
   */
  readonly forward?:
    | { readonly label: string; readonly onPress: () => void }
    | undefined;
  readonly ratings: readonly MultiplayerRatingView[];
  readonly onOpen: (place: MultiplayerPlace) => void;
  /** Starts a search, at the chosen time control when the game is timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
  /**
   * The person's unfinished game, offered in place of the search's command:
   * seeking is never offered while a game is unfinished.
   */
  readonly returnTo?: UnfinishedGame['kind'] | undefined;
  /** Goes back to that game's board. */
  readonly onReturn?: (() => void) | undefined;
  /**
   * How many matched games are left today, said only once few are, with the
   * way to play unlimited (its unlock's label and action).
   */
  readonly gamesLeft?: MatchedGamesLeftView | undefined;
};

/** Today's matched games left, and the way to play unlimited. */
export type MatchedGamesLeftView = {
  readonly left: number;
  readonly action?:
    | { readonly label: string; readonly onPress: () => void }
    | undefined;
};

/** "2 free games left today", with the way to unlimited beside it. */
function GamesLeftNotice(props: {
  readonly gamesLeft: MatchedGamesLeftView;
}): JSX.Element {
  const left = () => props.gamesLeft.left;
  return (
    <ActionNotice
      icon={ClockIcon}
      title={
        <Plural
          value={left()}
          one="# free game left today"
          other="# free games left today"
        />
      }
      body={<Trans>Accounts play unlimited games.</Trans>}
      action={
        props.gamesLeft.action === undefined
          ? undefined
          : {
              label: <>{props.gamesLeft.action.label}</>,
              onClick: () => props.gamesLeft.action?.onPress(),
            }
      }
      dataSet={{
        testid: 'multiplayer-games-left',
        left: String(left()),
      }}
    />
  );
}

/**
 * What the search plays for, in one line over the game's name, as a custom
 * game's lobby says it: ranked and rated, and untimed when the game has no
 * clock choices (a timed game's clock is the row below, said once).
 */
function FindEyebrow(props: {
  readonly find: MultiplayerFindChoice;
}): JSX.Element {
  return (
    <>
      {/* A dot stays with the fact before it, so a wrapped line never
          starts with one. */}
      <Trans>Ranked match</Trans>
      {'\u00a0· '}
      <Text variant="inherit" testId="multiplayer-find-rated">
        <Trans>Rated</Trans>
      </Text>
      <Show when={!props.find.timed}>
        {'\u00a0· '}
        <Text variant="inherit" testId="multiplayer-find-clock">
          <Trans>Untimed</Trans>
        </Text>
      </Show>
    </>
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

/**
 * The match the search sets up, one row each: the clock it is played at
 * (the one choice, when the game offers clocks) and the rating it plays
 * for. Each row opens its own place.
 */
function MatchRows(props: FindProps): JSX.Element {
  return (
    <MenuSection
      title={<Trans>Your match</Trans>}
      footer={
        props.find.players > 2 ? (
          <Text variant="inherit" testId="multiplayer-find-players">
            <PlayersNeeded find={props.find} />
          </Text>
        ) : undefined
      }
    >
      <Show when={props.find.timed}>
        <MenuRow
          leading={<ClockIcon size={24} />}
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
        leading={<GaugeIcon size={24} />}
        title={<Trans>Your ratings</Trans>}
        value={
          <Show when={ratingAtStake(props)}>
            {(rating) => <MultiplayerRatingFigure rating={rating()} />}
          </Show>
        }
        onClick={() => props.onOpen({ screen: 'ratings', from: 'home' })}
        dataSet={{ testid: 'multiplayer-open-ratings' }}
      />
    </MenuSection>
  );
}

/**
 * What stands behind a search, kept under the choices: how matchmaking
 * works, one row away, and where the found game is played.
 */
function FindAbout(props: Pick<FindProps, 'onOpen'>): JSX.Element {
  return (
    <MenuSection
      footer={
        <Text variant="inherit" testId="multiplayer-find-space">
          <Trans>
            The game opens in this space, where everyone can watch. Your
            opponent plays from their own space.
          </Trans>
        </Text>
      }
    >
      <MenuRow
        leading={<InfoIcon size={24} />}
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
        <Show when={props.offline === true}>
          <P
            variant="caption"
            tone="warning"
            align="center"
            role="status"
            lines={2}
            testId="multiplayer-offline"
          >
            <Trans>
              You're offline. Find an opponent comes back with the connection.
            </Trans>
          </P>
        </Show>
      }
    >
      <Show when={props.forward} keyed>
        {(forward) => (
          <Button
            title={forward.label}
            size="lg"
            fullWidth
            onClick={() => forward.onPress()}
            dataSet={{ testid: 'multiplayer-find-forward' }}
          />
        )}
      </Show>
      <Show when={props.forward === undefined}>
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
          disabled={props.findRefused === true}
          dataSet={{ testid: 'multiplayer-find' }}
        />
      </Show>
    </GameLobbyDock>
  );
}

/**
 * Finding an opponent, or the other players of a bigger game: one compact
 * card of what will be played (ranked and rated over the game's name and
 * how it is won), the match's choices as rows (the clock, the rating it
 * plays for), how a search works under them, and the search's one command
 * in a dock at the foot of the screen — or, while the person has an
 * unfinished game, the way back to it in its place. Nothing is said twice.
 */
export function MatchmakingHomeView(props: FindProps): JSX.Element {
  return (
    <MultiplayerLobbyPlace
      {...props}
      dock={
        <Show when={props.returnTo} fallback={<FindDock {...props} />}>
          {(kind) => (
            <GameLobbyDock>
              <ReturnOffer
                kind={kind()}
                placement="inline"
                finishFirst
                onReturn={() => props.onReturn?.()}
              />
            </GameLobbyDock>
          )}
        </Show>
      }
    >
      <GameModeCard
        eyebrow={<FindEyebrow find={props.find} />}
        title={props.title}
        summary={props.goal}
        dataSet={{ testid: 'multiplayer-find-conditions' }}
      />
      <Show when={props.find.fresh === true}>
        <P variant="caption" tone="secondary" testId="multiplayer-unavailable">
          <Text variant="inherit" role="status">
            <Trans>
              No ranked game here yet. Your first search starts one.
            </Trans>
          </Text>
        </P>
      </Show>
      <Show when={props.returnTo === undefined ? props.gamesLeft : undefined}>
        {(gamesLeft) => <GamesLeftNotice gamesLeft={gamesLeft()} />}
      </Show>
      <MatchRows {...props} />
      <FindAbout onOpen={props.onOpen} />
    </MultiplayerLobbyPlace>
  );
}
