import { ConnectFourStoryBoard } from '@libs/game-session-client-ts/connect-four-story-board.example';
import { SpacePersonAvatar } from '@libs/spaces-client-ts/space-person-view';
import { AVERY, JORDAN } from '@libs/spaces-client-ts/spaces-story.example';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameClock } from '@pkgs/ui-root-client-ts/game-clock';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal, Show } from 'solid-js';
import { fn } from 'storybook/test';
import {
  MatchmakingScreenView,
  type MatchmakingScreenViewProps,
} from './matchmaking-screen-view';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
  MultiplayerMovesShown,
} from './multiplayer-game-view';
import type { MultiplayerResultShown } from './multiplayer-result-card';
import { useMultiplayerPlaces } from './use-multiplayer-places';

const resolved = () => fn(() => Promise.resolve());

/** A rating per speed, some settled and some provisional. */
export const SPEED_RATINGS = [
  { pool: 'bullet', rating: 1500, games: 0 },
  { pool: 'blitz', rating: 1623, games: 41 },
  { pool: 'rapid', rating: 1488, games: 12 },
  { pool: 'classical', rating: 1500, games: 0 },
  { pool: 'daily', rating: 1551, games: 3 },
] as const;

const DROPS = [3, 3, 4, 2, 4];

/** The story game's moves, on the position after `shownPly` of them. */
export function storyMoves(
  shownPly = DROPS.length,
  drops: readonly number[] = DROPS
): MultiplayerMovesShown {
  const moves = drops.map((column, index) => {
    const round = Math.floor(index / 2) + 1;
    // A drop is named as Connect Four names it: its column, from 1.
    const san = String(column + 1);
    const ordinal = `${String(round)}${index % 2 === 0 ? '.' : '...'}`;
    return {
      ply: index + 1,
      san,
      numbering: index % 2 === 0 ? ordinal : '',
      name: `${ordinal} ${san}`,
      // Each move beside the disc of the seat that made it, as the app does.
      swatch:
        index % 2 === 0
          ? ({ color: 'disc-one', mark: '●' } as const)
          : ({ color: 'disc-two', mark: '◆' } as const),
    };
  });
  return {
    moves,
    shownPly,
    reviewing:
      shownPly >= moves.length
        ? null
        : { after: moves[shownPly - 1]?.name ?? null },
    // Connect Four's word for its bare-number moves, as its presentation says.
    heading: 'Column',
  };
}

/** A two-player game in play, as the person to move may act on it. */
export const STORY_GAME: MultiplayerGameView = {
  timeControl: '5+0',
  players: 2,
  leave: 'resign',
  draw: 'offer',
  rematch: 'none',
  newOpponent: false,
  flip: { flipped: false },
  moves: storyMoves(),
  record: null,
};

/** The same game once it is over with a result. */
export const STORY_FINISHED_GAME: MultiplayerGameView = {
  ...STORY_GAME,
  leave: null,
  draw: 'none',
  rematch: 'offer',
  newOpponent: true,
  record: {
    record: '1. 4 4 2. 5 3 3. 5 1-0',
    finalPosition: 'connect-four:3,3,4,2,4',
  },
};

/** Commands that succeed and record that they were given. */
export function storyCommands(): MultiplayerGameCommands {
  return {
    offerDraw: resolved(),
    acceptDraw: resolved(),
    declineDraw: resolved(),
    offerRematch: resolved(),
    acceptRematch: resolved(),
    declineRematch: resolved(),
    newOpponent: resolved(),
    ask: fn(),
    flip: fn(),
    chooseMove: fn(),
    stepBack: fn(),
    stepForward: fn(),
    goToStart: fn(),
    returnToCurrent: fn(),
    copy: resolved(),
  };
}

/** The two players as the app shows them: each with their own picture. */
function StoryAvatar(props: {
  readonly who: 'alice' | 'bob';
  readonly size: number;
}): JSX.Element {
  return (
    <SpacePersonAvatar
      person={props.who === 'alice' ? AVERY : JORDAN}
      size={props.size}
    />
  );
}

/**
 * Story-only: the matched game's stage, standing in for the board slot
 * `MultiplayerScreen` fills: two seats around Connect Four's board.
 */
export function StoryStage(props: {
  readonly moves?: readonly number[] | undefined;
  readonly onDrop?: ((column: number) => void) | undefined;
  /** How many of the story game's drops the board shows. */
  readonly shown?: number | undefined;
  /** Whether the person is to move. */
  readonly active: boolean;
  /** The person's own name; a long one must stay one cut-short line. */
  readonly ownName?: string | undefined;
  /** The viewer only watches: neither seat is theirs, no move is theirs. */
  readonly watching?: boolean | undefined;
  readonly offline?: boolean | undefined;
  /** A draw offered to the person waits for their answer first. */
  readonly answering?: boolean | undefined;
  readonly information: JSX.Element;
  readonly preparation?: JSX.Element;
}): JSX.Element {
  const drops = () =>
    props.moves ?? DROPS.slice(0, props.shown ?? DROPS.length);
  return (
    <GameBoardStage
      information={props.information}
      others={
        <GamePlayerBar
          name="Bob (1487)"
          avatar={<StoryAvatar who="bob" size={GAME_PLAYER_AVATAR_SIZE} />}
          swatch={{ color: 'disc-two', mark: '◆' }}
          swatchLabel="Yellow"
          // The story game is played at 5+0: each seat shows its clock, as
          // the app's seats do.
          trailing={<GameClock label="Yellow" value="4:12" />}
        />
      }
      own={
        <GamePlayerBar
          name={props.ownName ?? 'alice'}
          plainName={props.ownName}
          avatar={<StoryAvatar who="alice" size={GAME_PLAYER_AVATAR_SIZE} />}
          swatch={{ color: 'disc-one', mark: '●' }}
          swatchLabel="Red"
          // As the app's seat: `You` after the person's own name, their
          // colour the swatch (and, to a listener, `You play Red`); a
          // watcher reads a seat's side from its swatch alone.
          nameTag={
            <Show when={props.watching !== true}>
              <Badge
                intent="brand"
                size="sm"
                tone="solid"
                label={
                  <>
                    You<VisuallyHidden> play Red</VisuallyHidden>
                  </>
                }
              />
            </Show>
          }
          tags={
            <Show when={props.offline === true}>
              <Badge intent="warning" label="Offline" />
            </Show>
          }
          tagsPlacement="line"
          // As the app's seat: a draw offered to the person keeps their
          // seat to move (playing on declines it), its clock running.
          active={props.active && props.offline !== true}
          // The person's own turn is the status line's "Your turn.": as
          // the app's seat, only a watcher's seat says it in words.
          turnLabel={props.watching === true ? 'To move' : undefined}
          trailing={
            <GameClock
              label="Red"
              value="3:47"
              active={props.active && props.offline !== true}
            />
          }
        />
      }
    >
      {props.preparation}
      <ConnectFourStoryBoard
        onDrop={props.onDrop}
        moves={drops()}
        interactive={
          props.active && props.watching !== true && props.offline !== true
        }
        // A move still declines the offer, so the board stays playable,
        // but the answer is asked for first, as the app's board says.
        prompt={
          props.answering === true
            ? 'Drop a disc to decline and play on'
            : undefined
        }
      />
    </GameBoardStage>
  );
}

/** Story-only: the line under the board while the game is played. */
export function StoryAnnouncement(props: {
  readonly title: string;
  readonly detail?: string | undefined;
  /** An offer waiting for the person's answer: the filled pill, as the app's. */
  readonly answer?: boolean | undefined;
}): JSX.Element {
  return (
    <GameTurnPill
      live
      look={props.answer === true ? 'pill' : 'plain'}
      emphasis="yours"
      title={props.title}
      detail={props.detail}
    />
  );
}

/** What every story of `MatchmakingScreenView` shares: its route and its controls. */
export const STORY_PARAMETERS = {
  appRouter: true,
  controls: {
    exclude: [
      'place',
      'denial',
      'commandDenial',
      'gamesLeft',
      'find',
      'search',
      'you',
      'ratings',
      'game',
      'commands',
      'board',
      'setup',
      'status',
      'goal',
      'result',
    ],
  },
};

/** Every argument a story of `MatchmakingScreenView` starts from. */
export function storyArgs(): MatchmakingScreenViewProps {
  return {
    title: 'Connect Four',
    goal: 'Drop discs in turn. Four of yours in a row wins.',
    stage: 'idle',
    place: { screen: 'home' },
    onOpen: fn(),
    onBack: fn(),
    onLeave: fn(),
    error: null,
    online: true,
    find: { players: 2, timed: false, timeControl: '5+0' },
    onChooseTimeControl: fn(),
    onFind: resolved(),
    search: null,
    onStop: resolved(),
    ratings: [{ pool: 'game', rating: 1512, games: 34 }],
    game: null,
    commands: storyCommands(),
    confirming: null,
    manyPlayers: false,
    onConfirm: resolved(),
    onCloseConfirm: fn(),
  };
}

/**
 * Story-only: the private setup panel, standing in for the setup slot
 * `MultiplayerScreen` fills with the game's own setup board.
 */
function StorySetup(props: {
  readonly status: string;
  readonly choosing?: boolean | undefined;
}): JSX.Element {
  return (
    <GameSection
      title="Private setups"
      description="Each side chooses a private setup before the first move."
    >
      <Show when={props.choosing === true}>
        <GameActions>
          <Button title="Random setup" variant="outline" intent="neutral" />
          <Button title="Choose this setup" disabled />
        </GameActions>
      </Show>
      <P variant="bodyBold" role="status">
        {props.status}
      </P>
      <StackHorizontal wrap align="center" gap="sm">
        <Badge intent="neutral" label="First side" />
        <Badge intent="neutral" label="Getting ready" />
        <Badge intent="neutral" label="Second side" />
        <Badge intent="success" label="Ready" />
      </StackHorizontal>
    </GameSection>
  );
}

/**
 * Story-only: `MatchmakingScreenView` moved by the template's own place
 * machine, opening on the story's `place`, so a story is one place and a
 * play function can cross to the next as a person does. The clock chosen on
 * the way is kept, as the screen's container keeps it.
 */
export function StoryPlaces(props: MatchmakingScreenViewProps): JSX.Element {
  const nav = useMultiplayerPlaces(
    () => props.stage,
    () => props.commands.returnToCurrent()
  );
  const [chosen, setChosen] = createSignal<string | null>(null);
  createEffect(
    () => props.place,
    (place) => {
      nav.open(place);
    }
  );
  return (
    <MatchmakingScreenView
      {...props}
      place={nav.place()}
      find={{
        ...props.find,
        timeControl: chosen() ?? props.find.timeControl,
      }}
      onChooseTimeControl={(timeControl) => {
        props.onChooseTimeControl(timeControl);
        setChosen(timeControl);
      }}
      onOpen={(place) => {
        props.onOpen(place);
        nav.open(place);
      }}
      onBack={() => {
        props.onBack();
        nav.back();
      }}
    />
  );
}

/** What a story puts in the view's slots. */
export type StorySlots = {
  /** How many of the story game's drops the board shows. */
  readonly shown?: number;
  /** The person's own name, when the story is about a long one. */
  readonly ownName?: string;
  /** The viewer watches the game: no seat and no move are theirs. */
  readonly watching?: boolean;
  /** No connection: the board takes no move until it returns. */
  readonly offline?: boolean;
  /** The line under the board. */
  readonly announcement?: {
    readonly title: string;
    readonly detail?: string;
    readonly answer?: boolean;
  };
  /** How the game ended, on the result card. */
  readonly result?: MultiplayerResultShown;
  /** The private setup panel. */
  readonly setup?: { readonly status: string; readonly choosing?: boolean };
};

/**
 * A story's render: `StoryPlaces` with its slots filled when a place asks
 * for them, never at module load.
 */
export function renderStory(slots: StorySlots = {}) {
  return (args: MatchmakingScreenViewProps): JSX.Element => (
    <StoryPlaces
      {...args}
      you={{
        avatar: <Avatar kind="person" />,
        name: args.you?.name ?? 'River',
      }}
      board={(stage) => (
        <StoryStage
          shown={slots.shown}
          ownName={slots.ownName}
          watching={slots.watching}
          offline={slots.offline}
          answering={slots.announcement?.answer === true}
          active={slots.announcement !== undefined}
          information={stage.information}
          preparation={stage.setup}
        />
      )}
      status={
        slots.announcement === undefined ? undefined : (
          <StoryAnnouncement {...slots.announcement} />
        )
      }
      result={slots.result}
      setup={
        slots.setup === undefined ? undefined : <StorySetup {...slots.setup} />
      }
    />
  );
}
