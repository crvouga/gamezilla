import { ConnectFourStoryBoard } from '@libs/game-session-client-ts/connect-four-story-board.example';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameResultHeadline } from '@pkgs/ui-root-client-ts/game-result';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createRenderEffect, createSignal, type JSX, Show } from 'solid-js';
import { fn } from 'storybook/test';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
  MultiplayerMovesShown,
} from './multiplayer-game-view';
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
    const san = `${COLUMNS[column] ?? 'a'}${String(index + 1)}`;
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
    record: '1. d1 d2 2. e3 c4 3. e5 1-0',
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

/**
 * Story-only: the matched game's stage, standing in for the board slot
 * `MultiplayerScreen` fills: two seats around Connect Four's board, then
 * the announcement line.
 */
function StoryStage(props: {
  /** How many of the story game's drops the board shows. */
  readonly shown?: number | undefined;
  /** The line under the board; none on the result, whose headline says it. */
  readonly announcement?: JSX.Element | undefined;
}): JSX.Element {
  const drops = () => DROPS.slice(0, props.shown ?? DROPS.length);
  return (
    <StackVertical gap="md">
      <GameBoardStage
        others={
          <GamePlayerBar
            name="Bob (1500?)"
            swatch={{ color: 'disc-two' }}
            tags={<Badge intent="neutral" label="Yellow" />}
          />
        }
        own={
          <GamePlayerBar
            name="alice"
            swatch={{ color: 'disc-one' }}
            tags={<Badge intent="neutral" label="You play Red" />}
            active={props.announcement !== undefined}
            turnLabel="Your move"
          />
        }
      >
        <ConnectFourStoryBoard moves={drops()} interactive />
      </GameBoardStage>
      {props.announcement}
    </StackVertical>
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

/** Story-only: the result's headline. */
function StoryOutcome(props: {
  readonly title: string;
  readonly caption: string;
}): JSX.Element {
  return <GameResultHeadline title={props.title} caption={props.caption} />;
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
      'outcome',
    ],
  },
};

/** Every argument a story of `MultiplayerScreenView` starts from. */
export function storyArgs(): MultiplayerScreenViewProps {
  return {
    title: 'Connect Four',
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
    ratings: [{ pool: 'game', rating: 1512, games: 7 }],
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
  createRenderEffect(() => nav.open(props.place));
  return (
    <MultiplayerScreenView
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
  /** The line under the board. */
  readonly announcement?: { readonly title: string; readonly detail?: string };
  /** The result's headline. */
  readonly outcome?: { readonly title: string; readonly caption: string };
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
      board={
        <StoryStage
          shown={slots.shown}
          announcement={
            slots.announcement === undefined ? undefined : (
              <StoryAnnouncement {...slots.announcement} />
            )
          }
        />
      }
      outcome={
        slots.outcome === undefined ? undefined : (
          <StoryOutcome {...slots.outcome} />
        )
      }
      setup={
        slots.setup === undefined ? undefined : <StorySetup {...slots.setup} />
      }
    />
  );
}
