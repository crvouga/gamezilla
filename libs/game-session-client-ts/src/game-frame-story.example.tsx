import {
  type SpacePerson,
  SpacePersonAvatar,
} from '@libs/spaces-client-ts/space-person-view';
import {
  AVERY as AVERY_PERSON,
  JORDAN as JORDAN_PERSON,
  MORGAN as MORGAN_PERSON,
  ROBIN as ROBIN_PERSON,
} from '@libs/spaces-client-ts/spaces-story.example';
import type { GameOptionGroup } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { fn } from 'storybook/test';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
  FRAME_NO_TABLE,
} from './game-frame-empty';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import type {
  FrameHolder,
  FramePeople,
  FramePlaySeat,
  FrameRecord,
  FrameSeat,
  FrameSetup,
  FrameSetupSeat,
  FrameStatus,
} from './game-frame-view-types';

/**
 * Story-only fixtures for the game frame: Connect Four's two seats (its
 * side names and discs), people with fixed ids, and the frame's resting
 * args. Every story starts from `FRAME_ARGS` and sets only its state.
 */

export const PEOPLE = {
  avery: '0b6a1c52-0000-4000-8000-000000000001',
  jordan: '0b6a1c52-0000-4000-8000-000000000002',
  morgan: '0b6a1c52-0000-4000-8000-000000000003',
  robin: '0b6a1c52-0000-4000-8000-000000000004',
} as const;

/** Each frame person as the space stories show them, with a seeded avatar. */
const SPACE_PEOPLE: ReadonlyMap<string, SpacePerson> = new Map([
  [PEOPLE.avery, AVERY_PERSON],
  [PEOPLE.jordan, JORDAN_PERSON],
  [PEOPLE.morgan, MORGAN_PERSON],
  [PEOPLE.robin, ROBIN_PERSON],
]);

/**
 * How the stories show a person, as the app does with the live profile:
 * their own avatar (the plain name stays the shown name).
 */
export const STORY_PEOPLE: FramePeople = {
  avatar: (person, size) => (
    <SpacePersonAvatar person={SPACE_PEOPLE.get(person) ?? null} size={size} />
  ),
};

const LOOKS = {
  white: { sideLabel: 'Red circle', swatch: { color: 'disc-one', mark: '●' } },
  black: {
    sideLabel: 'Yellow diamond',
    swatch: { color: 'disc-two', mark: '◆' },
  },
  red: { sideLabel: 'Third seat', swatch: { color: 'player2', mark: '▲' } },
  blue: { sideLabel: 'Fourth seat', swatch: { color: 'player3', mark: '■' } },
} as const satisfies Record<GameSide, Pick<FrameSeat, 'sideLabel' | 'swatch'>>;

export function person(name: keyof typeof PEOPLE): FrameHolder {
  return { kind: 'person', person: PEOPLE[name] };
}

/** One seat's identity: who holds it, under Connect Four's look for the side. */
export function seat(
  side: GameSide,
  holder: FrameHolder,
  plainName: string,
  clock: FrameSeat['clock'] = null
): FrameSeat {
  return { side, ...LOOKS[side], holder, plainName, clock };
}

/** A seat at the table while the game is played. */
export function playSeat(
  base: FrameSeat,
  over: Partial<FramePlaySeat> = {}
): FramePlaySeat {
  return {
    ...base,
    stat: null,
    state: null,
    standIn: false,
    committed: false,
    choosing: false,
    facts: [],
    deciding: false,
    reclaim: false,
    ...over,
  };
}

/** A seat while the game is set up, as the host sees it. */
export function setupSeat(
  base: FrameSeat,
  over: Partial<FrameSetupSeat> = {}
): FrameSetupSeat {
  return {
    ...base,
    host: false,
    visiting: false,
    own: false,
    ready: false,
    invitation: null,
    canSit: false,
    canLeave: false,
    choices: null,
    ...over,
  };
}

export const AVERY = seat('white', person('avery'), 'avery');
export const JORDAN = seat('black', person('jordan'), 'jordan_plays');
export const BOT = seat(
  'black',
  { kind: 'bot', level: 'medium' },
  'Bot (medium)'
);

/** The one line about the game, as the host of a Connect Four game reads it. */
export function status(over: Partial<FrameStatus> = {}): FrameStatus {
  return {
    lineup: 'Red circle: avery. Yellow diamond: jordan_plays.',
    description: 'Red circle to move.',
    plainTurn: true,
    emphasis: 'yours',
    tone: 'neutral',
    sending: false,
    minutes: 0,
    increment: 0,
    ...over,
  };
}

/** The record of a game played by turns, at its latest move: the two seats alternate. */
export function record(moves: readonly string[]): FrameRecord {
  return {
    earlier: [],
    selection: 'live',
    turns: true,
    moves,
    perTurn: 2,
    movers: moves.map((_, index) => LOOKS[index % 2 === 0 ? 'white' : 'black']),
    // Connect Four's moves are column numbers: the record says `col 3`.
    moveHeading: 'Column',
    displayedPly: moves.length,
    error: '',
    history: true,
  };
}

/** Everything about setting up a game except its seats. */
export function setup(
  seats: readonly FrameSetupSeat[],
  over: Partial<FrameSetup> = {}
): FrameSetup {
  return {
    viewerNotice: null,
    takeSeat: null,
    seats,
    privateSetup: null,
    options: null,
    start: {
      reason: null,
      hostStarts: false,
      readiness: { ready: true, blocked: false },
      canStart: true,
    },
    ...over,
  };
}

/** A game's own options: a choice and a count, read from the position. */
export const RULE_OPTIONS: readonly GameOptionGroup[] = [
  {
    kind: 'choice',
    id: 'variant',
    label: () => 'Variant',
    options: [
      { value: 'classic', label: () => 'Classic' },
      { value: 'pop-out', label: () => 'Pop out' },
    ],
    default: 'classic',
    read: () => 'classic',
    encode: (value) => `variant:${value}`,
  },
  {
    kind: 'count',
    id: 'rounds',
    label: () => 'Rounds',
    min: 1,
    max: 5,
    default: 3,
    read: () => 3,
    encode: (value) => `rounds:${String(value)}`,
  },
];

/** Moves in column order, from the left (0) to the right (6). */
/** Connect Four writes a move as its column, counted from 1. */
function columnRecord(moves: readonly number[]): readonly string[] {
  return moves.map((column) => String(column + 1));
}

/**
 * Eight drops, four each: Red circle (the viewer) moves first, so it is
 * Red circle's turn again, as the frame's own-turn stories say.
 */
export const MID_GAME_MOVES = [3, 3, 4, 2, 2, 4, 5, 1];
/** Seven drops: Yellow diamond (the opponent) is to move. */
export const OPPONENT_TURN_MOVES = MID_GAME_MOVES.slice(0, 7);
export const MID_GAME_RECORD = columnRecord(MID_GAME_MOVES);
/** Ten drops, five each: Red circle to move, as a real game's middle reads. */
export const YOUR_TURN_MOVES = [3, 3, 2, 4, 4, 5, 2, 1, 6, 3];
export const YOUR_TURN_RECORD = columnRecord(YOUR_TURN_MOVES);
/** Red circle drops four in column 4. */
export const WON_MOVES = [3, 2, 3, 2, 3, 2, 3];
/** The four cells of Red circle's line in column 4, bottom row first. */
export const WON_LINE = [3, 10, 17, 24];
export const WON_RECORD = columnRecord(WON_MOVES);

const resolved = () => fn(() => Promise.resolve());

/** The frame at rest: no game yet, a host who may create one. */
export function frameArgs(): GameFrameScreenViewProps {
  return {
    title: 'Connect Four',
    phase: 'none',
    viewerSide: 'white',
    watchers: 0,
    connection: 'online',
    error: '',
    stopped: false,
    status: null,
    canCreate: true,
    playerCount: 2,
    setup: null,
    table: FRAME_NO_TABLE,
    play: FRAME_NO_PLAY,
    result: null,
    next: FRAME_NO_NEXT,
    record: null,
    people: STORY_PEOPLE,
    onChoose: resolved(),
    onReady: resolved(),
    onPlayBot: resolved(),
    onRandomSetup: resolved(),
    onBack: fn(),
    onSeek: fn(),
    onReturnLive: fn(),
    onSelectRecord: fn(),
    onOpenHistory: fn(),
  };
}

/** Controls cannot edit slots, callbacks or nested frame data. */
export const FRAME_CONTROLS_EXCLUDE = [
  'board',
  'setupBoard',
  'boardState',
  'people',
  'denial',
  'setup',
  'table',
  'play',
  'result',
  'next',
  'record',
  'status',
];
