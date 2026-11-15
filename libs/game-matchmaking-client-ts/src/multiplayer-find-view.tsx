import {
  TIME_CONTROLS,
  timeControlKey,
  timeControlOf,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  type GameChoice,
  GameChoiceGrid,
} from '@pkgs/ui-root-client-ts/game-choice-grid';
import {
  GameLobbyDock,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { CircleCheckIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { MultiplayerGuidePoints } from './multiplayer-guide-view';
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
import { timeControlChoiceText } from './time-control-name';

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
  /** Chooses the clock of the next search, staying on this screen. */
  readonly onChooseTimeControl: (timeControl: string) => void;
  /** Starts a search, at the chosen time control when the game is timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
  /** Searching needs a connection. */
  readonly online: boolean;
  /** Leaves finding an opponent for the game's choices, where its games are. */
  readonly onLeave: () => void;
  /**
   * The last search was refused because another game is still on: a custom
   * game, or another matched game. The notice above says so; the dock leads
   * to it first, and searching again is the quiet second command.
   */
  readonly blocked: MultiplayerBlock | null;
  /** Opens the game's custom game, where a custom game still on is played. */
  readonly onOpenCustomGame?: (() => void) | undefined;
  /** This device just stopped its search. */
  readonly stopped?: boolean | undefined;
};

/** Which other game refused the search. */
export type MultiplayerBlock = 'custom-game' | 'matched-game';

/** The clocks offered on the screen itself, one or two of every speed. */
const QUICK_CLOCKS: readonly string[] = [
  '1+0',
  '3+2',
  '5+0',
  '10+0',
  '15+10',
  '30+0',
];

/** A time control without the game's prefix (`chess/5+0` is `5+0`). */
function plainClock(id: string): string {
  return id.split('/').at(-1) ?? id;
}

/**
 * The quick clocks, the chosen one always among them: a choice made on the
 * full list takes the place of the quick clock of its own speed, or the
 * last one.
 */
export function quickClocks(chosen: string): readonly string[] {
  const plain = plainClock(chosen);
  if (QUICK_CLOCKS.includes(plain)) return QUICK_CLOCKS;
  const speed = timeControlOf(plain)?.speed;
  const same = QUICK_CLOCKS.findIndex(
    (id) => timeControlOf(id)?.speed === speed
  );
  const at = same === -1 ? QUICK_CLOCKS.length - 1 : same;
  return QUICK_CLOCKS.map((id, index) => (index === at ? plain : id));
}

/** One quick clock as a tile: its figures over its speed. */
function clockChoice(id: string): GameChoice {
  const control = TIME_CONTROLS.find((candidate) => candidate.id === id);
  return {
    value: id,
    title: timeControlChoiceText(id),
    detail: <SpeedName speed={control?.speed ?? ''} />,
    dataSet: { testid: `multiplayer-clock-${timeControlKey(id)}` },
  };
}

/**
 * What the search will find, in one line over the game's name: rated, how
 * many play (when more than two) and, for a game without clock choices, that it is untimed (a
 * game with them shows its clock as the tiles below).
 */
function Conditions(props: {
  readonly find: MultiplayerFindChoice;
}): JSX.Element {
  return (
    <>
      <Text variant="inherit" testId="multiplayer-find-rated">
        <Show
          when={props.find.players > 2}
          fallback={<Trans>Ranked match</Trans>}
        >
          <Trans>Ranked</Trans>
        </Show>
      </Text>
      <Show when={props.find.players > 2}>
        {' · '}
        <Trans>{props.find.players} players</Trans>
      </Show>
      <Show when={!props.find.timed}>
        {' · '}
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
      fallback={<Trans>A game of you and {count() - 1} other players.</Trans>}
    >
      <Trans>
        A game of you and {count() - 1} other players, all at this clock.
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
 * The clock of the next search, chosen on the screen itself: the quick
 * clocks as tiles, and every other clock one row away.
 */
function ClockChoices(props: FindProps): JSX.Element {
  return (
    <Show when={props.find.timed}>
      <GameChoiceGrid
        label={<Trans>Clock</Trans>}
        choices={quickClocks(props.find.timeControl).map(clockChoice)}
        value={plainClock(props.find.timeControl)}
        onChange={(id) => props.onChooseTimeControl(id)}
      />
      <P variant="caption" tone="secondary">
        <Trans>
          Minutes each player has, plus seconds added after every move.
        </Trans>
      </P>
    </Show>
  );
}

/** Every other clock, the ratings and how a search works: one row each. */
function FindRows(props: FindProps): JSX.Element {
  return (
    <MenuSection>
      <Show when={props.find.timed}>
        <MenuRow
          title={<Trans>More time controls</Trans>}
          caption={<Trans>Longer games and daily play</Trans>}
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
      <Show when={props.find.fresh !== true}>
        <MenuRow
          title={<Trans>How it works</Trans>}
          onClick={() => props.onOpen({ screen: 'guide' })}
          dataSet={{ testid: 'multiplayer-open-guide' }}
        />
      </Show>
    </MenuSection>
  );
}

/** Where the search stands, in one line over its command. */
function FindStatus(props: FindProps): JSX.Element {
  return (
    <P
      variant="caption"
      tone="secondary"
      testId="multiplayer-find-space"
      role="status"
    >
      <Show
        when={props.online}
        fallback={<Trans>You're offline. Reconnect to search.</Trans>}
      >
        <Switch
          fallback={
            <Trans>
              Rated. The game opens in this space, and everyone here can watch.
            </Trans>
          }
        >
          <Match when={props.blocked === 'custom-game'}>
            <Trans>
              Your custom game is still on. Finish or leave it, then search
              again.
            </Trans>
          </Match>
          <Match when={props.blocked === 'matched-game'}>
            <Trans>
              Your other matched game is still on. Finish it, then search again.
            </Trans>
          </Match>
        </Switch>
      </Show>
    </P>
  );
}

/** Searching, or searching again after a refusal. */
function FindCommand(props: FindProps): JSX.Element {
  const many = () => props.find.players > 2;
  return (
    <GameActionButton
      title={
        <Switch fallback={<Trans>Find an opponent</Trans>}>
          <Match when={props.blocked !== null}>
            <Trans>Search again</Trans>
          </Match>
          <Match when={many()}>
            <Trans>Find players</Trans>
          </Match>
        </Switch>
      }
      successLabel={
        <Show when={many()} fallback={<Trans>Opponent search accepted</Trans>}>
          <Trans>Player search accepted</Trans>
        </Show>
      }
      operation={() =>
        props.onFind(props.find.timed ? props.find.timeControl : undefined)
      }
      variant={props.blocked !== null || !props.online ? 'outline' : 'solid'}
      size="lg"
      fullWidth
      dataSet={{ testid: 'multiplayer-find' }}
    />
  );
}

/** The search's one command, held at the foot of the screen. */
function FindDock(props: FindProps): JSX.Element {
  return (
    <GameLobbyDock status={<FindStatus {...props} />}>
      <Show when={props.blocked !== null}>
        <Show
          when={
            props.blocked === 'custom-game' ? props.onOpenCustomGame : undefined
          }
          fallback={
            <Button
              title={<Trans>Back to game choices</Trans>}
              variant="solid"
              size="lg"
              fullWidth
              onClick={() => props.onLeave()}
              dataSet={{ testid: 'multiplayer-blocked-leave' }}
            />
          }
        >
          {(open) => (
            <Button
              title={<Trans>Go to your custom game</Trans>}
              variant="solid"
              size="lg"
              fullWidth
              onClick={() => open()()}
              dataSet={{ testid: 'multiplayer-open-custom-game' }}
            />
          )}
        </Show>
      </Show>
      {/* A refusal remounts the command: the dock says why, so the button
          starts again quiet instead of holding its failure. */}
      <Show when={props.blocked ?? 'clear'} keyed>
        {(_state) => <FindCommand {...props} />}
      </Show>
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
        layout="banner"
        eyebrow={<Conditions find={props.find} />}
        title={props.title}
        summary={props.goal}
        dataSet={{ testid: 'multiplayer-find-conditions' }}
      />
      <Show when={props.stopped === true}>
        <Notice
          icon={CircleCheckIcon}
          dataSet={{ testid: 'multiplayer-stopped' }}
        >
          <Text variant="inherit" role="status">
            <Trans>
              Search stopped. You can search again whenever you like.
            </Trans>
          </Text>
        </Notice>
      </Show>
      {/* Refused while another game is still on: the screen says only that,
          and the dock leads to it; the choices wait until it is over. */}
      <Show when={props.blocked === null}>
        <Show when={props.find.fresh === true}>
          <Notice dataSet={{ testid: 'multiplayer-unavailable' }}>
            <Text variant="inherit" role="status">
              <Trans>
                No game has started here yet. Find an opponent to play your
                first rated game.
              </Trans>
            </Text>
          </Notice>
        </Show>
        <ClockChoices {...props} />
        <Show when={props.find.players > 2}>
          <P
            variant="caption"
            tone="secondary"
            testId="multiplayer-find-players"
          >
            <PlayersNeeded find={props.find} />
          </P>
        </Show>
        <FindRows {...props} />
        <Show when={props.find.fresh === true}>
          <MultiplayerGuidePoints
            title={<Trans>How ranked matches work</Trans>}
          />
        </Show>
      </Show>
    </MultiplayerLobbyPlace>
  );
}
