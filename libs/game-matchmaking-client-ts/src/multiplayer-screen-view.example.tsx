import { ConnectFourStoryBoard } from '@libs/game-session-client-ts/connect-four-story-board.example';
import {
  NO_STAGE_OVERLAY,
  type StageOverlay,
  stageOverlayAfter,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GAME_VERSUS_AVATAR_SIZE } from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createRenderEffect, createSignal, type JSX, Show } from 'solid-js';
import { fn } from 'storybook/test';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
  MultiplayerMovesShown,
} from './multiplayer-game-view';
import type {
  MultiplayerResultShown,
  MultiplayerVersusShown,
} from './multiplayer-overlay-view';
import {
  MultiplayerScreenView,
  type MultiplayerScreenViewProps,
} from './multiplayer-screen-view';
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

const COLUMNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const DROPS = [3, 3, 4, 2, 4];

/** The story game's moves, on the position after `shownPly` of them. */
export function storyMoves(shownPly = DROPS.length): MultiplayerMovesShown {
  const moves = DROPS.map((column, index) => {
    const round = Math.floor(index / 2) + 1;
    // A drop is named by its column and the row it lands on.
    const row = DROPS.slice(0, index + 1).filter((at) => at === column).length;
    const san = `${COLUMNS[column] ?? 'a'}${String(row)}`;
    const ordinal = `${String(round)}${index % 2 === 0 ? '.' : '...'}`;
    return {
      ply: index + 1,
      san,
      numbering: index % 2 === 0 ? ordinal : '',
      name: `${ordinal} ${san}`,
    };
  });
  return {
    moves,
    shownPly,
    reviewing:
      shownPly >= moves.length
        ? null
        : { after: moves[shownPly - 1]?.name ?? null },
  };
}

/** A two-player game in play, as the person to move may act on it. */
export const STORY_GAME: MultiplayerGameView = {
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
    record: '1. d1 d2 2. e1 c1 3. e2 1-0',
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

function StoryAvatar(props: {
  readonly who: 'alice' | 'bob';
  readonly size: number;
}): JSX.Element {
  return (
    <Avatar
      initials={props.who === 'alice' ? 'A' : 'B'}
      you={props.who === 'alice'}
      size={props.size}
    />
  );
}

/**
 * Who plays whom in the story game, as the versus card shows them. Made
 * when a story renders, never at module load: its faces read the theme.
 */
function storyVersus(): MultiplayerVersusShown {
  return {
    others: [
      {
        id: 'black',
        name: 'Bob',
        avatar: <StoryAvatar who="bob" size={GAME_VERSUS_AVATAR_SIZE} />,
        swatch: { color: 'disc-two' },
        caption: 'Yellow · 1487',
      },
    ],
    own: [
      {
        id: 'white',
        name: 'alice',
        avatar: <StoryAvatar who="alice" size={GAME_VERSUS_AVATAR_SIZE} />,
        swatch: { color: 'disc-one' },
        caption: 'Red · 1512',
      },
    ],
    clock: '5 min',
  };
}

/**
 * Story-only: the matched game's stage, standing in for the board slot
 * `MultiplayerScreen` fills: two seats around Connect Four's board, under
 * whatever lies over it.
 */
function StoryStage(props: {
  /** How many of the story game's drops the board shows. */
  readonly shown?: number | undefined;
  /** Whether the person is to move. */
  readonly active: boolean;
  readonly overlay?: JSX.Element | undefined;
}): JSX.Element {
  const drops = () => DROPS.slice(0, props.shown ?? DROPS.length);
  return (
    <GameBoardStage
      overlay={props.overlay}
      others={
        <GamePlayerBar
          name="Bob (1487)"
          avatar={<StoryAvatar who="bob" size={GAME_PLAYER_AVATAR_SIZE} />}
          swatch={{ color: 'disc-two' }}
          tags={<Badge intent="neutral" label="Yellow" />}
        />
      }
      own={
        <GamePlayerBar
          name="alice"
          avatar={<StoryAvatar who="alice" size={GAME_PLAYER_AVATAR_SIZE} />}
          swatch={{ color: 'disc-one' }}
          tags={<Badge intent="neutral" label="You play Red" />}
          active={props.active}
          turnLabel="Your move"
        />
      }
    >
      <ConnectFourStoryBoard moves={drops()} interactive />
    </GameBoardStage>
  );
}

/** Story-only: the line under the board while the game is played. */
function StoryAnnouncement(props: {
  readonly title: string;
  readonly detail?: string | undefined;
}): JSX.Element {
  return (
    <GameTurnPill
      live
      emphasis="yours"
      title={props.title}
      detail={props.detail}
      trailing={<Badge intent="neutral" label="5+0" />}
    />
  );
}

/** What every story of `MultiplayerScreenView` shares: its route and its controls. */
export const STORY_PARAMETERS = {
  appRouter: true,
  controls: {
    exclude: [
      'place',
      'denial',
      'commandDenial',
      'find',
      'search',
      'ratings',
      'game',
      'commands',
      'board',
      'setup',
      'status',
      'goal',
      'overlay',
      'versus',
      'result',
    ],
  },
};

/** Every argument a story of `MultiplayerScreenView` starts from. */
export function storyArgs(): MultiplayerScreenViewProps {
  return {
    title: 'Connect Four',
    goal: 'Drop discs in turn. Four of yours in a row wins.',
    stage: 'idle',
    place: { screen: 'find' },
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
    overlay: NO_STAGE_OVERLAY,
    onOverlay: fn(),
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
 * Story-only: `MultiplayerScreenView` moved by the template's own place
 * machine, opening on the story's `place`, so a story is one place and a
 * play function can cross to the next as a person does. The clock chosen on
 * the way is kept, as the screen's container keeps it.
 */
export function StoryPlaces(props: MultiplayerScreenViewProps): JSX.Element {
  const nav = useMultiplayerPlaces(
    () => props.stage,
    () => props.commands.returnToCurrent()
  );
  const [chosen, setChosen] = createSignal<string | null>(null);
  // The story's overlay answers a press as the app's does; the count is
  // held still, so a story is one moment.
  const [overlay, setOverlay] = createSignal<StageOverlay>(props.overlay);
  createRenderEffect(() => setOverlay(props.overlay));
  createRenderEffect(() => nav.open(props.place));
  return (
    <MultiplayerScreenView
      {...props}
      place={nav.place()}
      overlay={overlay()}
      onOverlay={(event) => {
        props.onOverlay(event);
        setOverlay((current) => stageOverlayAfter(current, event));
      }}
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
  /** The line under the board. */
  readonly announcement?: { readonly title: string; readonly detail?: string };
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
  return (args: MultiplayerScreenViewProps): JSX.Element => (
    <StoryPlaces
      {...args}
      board={(overlay) => (
        <StoryStage
          shown={slots.shown}
          active={slots.announcement !== undefined}
          overlay={overlay}
        />
      )}
      status={
        slots.announcement === undefined ? undefined : (
          <StoryAnnouncement {...slots.announcement} />
        )
      }
      versus={storyVersus()}
      result={slots.result}
      setup={
        slots.setup === undefined ? undefined : <StorySetup {...slots.setup} />
      }
    />
  );
}
