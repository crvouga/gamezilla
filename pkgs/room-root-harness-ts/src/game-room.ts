import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import {
  createMessageNamespace,
  isMessageEnvelope,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import { defineRoomModule } from '@pkgs/room-root-shared-ts/module';
import type {
  HandleResult,
  RoomCommand,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

import {
  blackMsAttr,
  ClockAvailabilityChanged,
  clockAvailability,
  clocksPausedAttr,
  isNonNegInt,
  reduceClockAvailability,
  turnStartedAtAttr,
  whiteMsAttr,
} from './game-room-clock';
import {
  handleNote,
  initialNotes,
  noteAudience,
  reduceNote,
} from './game-room-notes';

/**
 * The example app every test of the room framework drives: a game room
 * friends share. It keeps
 *
 * - a **tally** anyone in the room can add one to or take one off;
 * - an **owner**: the first person to claim the room, who alone can turn
 *   someone away — every command from a turned-away person is refused as
 *   unauthorized;
 * - a **timed match** between the identities `white` and `black`: starting
 *   it arms a scheduled "ran out of time" for the player to move, each move
 *   re-arms it for the opponent, and the room ends the match when it fires;
 * - **sealed notes**: a note sealed for one person reaches only them
 *   (`game-room-notes`), the room's private events.
 *
 * One kitchen-sink module on purpose: a new room capability grows this app
 * instead of adding another fixture (README.md, "One example app per
 * package").
 */

export type Player = 'white' | 'black';

export const MATCH_STATUS = {
  notStarted: 'not started',
  playing: 'playing',
  over: 'over',
} as const;

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

const MATCH_STATUSES: readonly string[] = Object.values(MATCH_STATUS);

/** Why the game room refuses a command: what the person is told. */
export const REFUSAL = {
  alreadyOwned: 'the room already has an owner',
  onlyTheOwner: 'only the owner can turn someone away',
  ownerStays: 'the owner cannot turn themselves away',
  turnedAway: 'turned away',
  tooLate: 'the move came too late',
  timeLeft: 'the player still has time left',
} as const;

const RAN_OUT_OF_TIME_SCHEDULE_ID = 'game-room:ran-out-of-time';

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isPlayer(v: unknown): v is Player {
  return v === 'white' || v === 'black';
}

function isEmpty(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

function isPerson(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

const ns = createAttrNamespace('game-room');
const tallyAttr = ns.integer('tally', (v): number => (isInt(v) ? v : 0));
const ownerAttr = ns.textOrNull('owner', (v): string | null =>
  isPerson(v) ? v : null
);
const turnedAwayAttr = ns.array<string>('turned-away', (v) =>
  Array.isArray(v) ? v.filter(isPerson) : []
);
const matchStatusAttr = ns.text('match-status', (v): string =>
  typeof v === 'string' && MATCH_STATUSES.includes(v)
    ? v
    : MATCH_STATUS.notStarted
);
const playerToMoveAttr = ns.text('player-to-move', (v): string =>
  isPlayer(v) ? v : 'white'
);
const winnerAttr = ns.textOrNull('winner', (v): string | null =>
  isPlayer(v) ? v : null
);

const cmd = createMessageNamespace('game-room-cmd');
export const AddOne = cmd('add-one', isEmpty);
export const TakeOne = cmd('take-one', isEmpty);
export const ClaimRoom = cmd('claim', isEmpty);
export const TurnAway = cmd(
  'turn-away',
  (p): p is { person: string } => isPlainRecord(p) && isPerson(p['person'])
);
export const StartMatch = cmd(
  'start-match',
  (p): p is { whiteMs: number; blackMs: number } =>
    isPlainRecord(p) && isNonNegInt(p['whiteMs']) && isNonNegInt(p['blackMs'])
);
export const Move = cmd('move', isEmpty);
export const ClaimOutOfTime = cmd(
  'claim-out-of-time',
  (p): p is { player: Player } => isPlainRecord(p) && isPlayer(p['player'])
);

const evt = createMessageNamespace('game-room-evt');
export const TallyChanged = evt(
  'tally-changed',
  (p): p is { by: number } => isPlainRecord(p) && isInt(p['by'])
);
export const RoomClaimed = evt(
  'claimed',
  (p): p is { owner: string } => isPlainRecord(p) && isPerson(p['owner'])
);
export const TurnedAway = evt(
  'turned-away',
  (p): p is { person: string } => isPlainRecord(p) && isPerson(p['person'])
);
export const MatchStarted = evt(
  'match-started',
  (p): p is { whiteMs: number; blackMs: number; turnStartedAt: number } =>
    isPlainRecord(p) &&
    isNonNegInt(p['whiteMs']) &&
    isNonNegInt(p['blackMs']) &&
    isNonNegInt(p['turnStartedAt'])
);
export const Moved = evt(
  'moved',
  (
    p
  ): p is {
    playerToMove: Player;
    whiteMs: number;
    blackMs: number;
    turnStartedAt: number;
  } =>
    isPlainRecord(p) &&
    isPlayer(p['playerToMove']) &&
    isNonNegInt(p['whiteMs']) &&
    isNonNegInt(p['blackMs']) &&
    isNonNegInt(p['turnStartedAt'])
);
export const RanOutOfTime = evt(
  'ran-out-of-time',
  (p): p is { winner: Player } => isPlainRecord(p) && isPlayer(p['winner'])
);

function conflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

function unauthorized(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.unauthorized, reason } };
}

function invalid(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.invalidCommand, reason },
  };
}

function opponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

function bankOf(state: RoomState, player: Player): number {
  return player === 'white' ? whiteMsAttr.from(state) : blackMsAttr.from(state);
}

function armRanOutOfTime(player: Player, at: number): readonly Message[] {
  return [
    CancelScheduleEffect({ id: RAN_OUT_OF_TIME_SCHEDULE_ID }),
    ScheduleEffect({
      id: RAN_OUT_OF_TIME_SCHEDULE_ID,
      at,
      payload: ClaimOutOfTime({ player }),
    }),
  ];
}

function handleOwnership(
  state: RoomState,
  msg: Message,
  identity: string
): HandleResult | null {
  if (ClaimRoom.is(msg)) {
    if (ownerAttr.from(state) !== null) {
      return conflict(REFUSAL.alreadyOwned);
    }
    return { ok: true, events: [RoomClaimed({ owner: identity })] };
  }
  if (TurnAway.is(msg)) {
    const owner = ownerAttr.from(state);
    if (owner !== identity) {
      return unauthorized(REFUSAL.onlyTheOwner);
    }
    if (msg.payload.person === owner) {
      return conflict(REFUSAL.ownerStays);
    }
    return { ok: true, events: [TurnedAway({ person: msg.payload.person })] };
  }
  return null;
}

function handleMatch(
  state: RoomState,
  command: RoomCommand,
  msg: Message,
  identity: string
): HandleResult | null {
  const status = matchStatusAttr.from(state);
  if (StartMatch.is(msg)) {
    if (status !== MATCH_STATUS.notStarted) {
      return conflict(`match is ${status}`);
    }
    return {
      ok: true,
      events: [MatchStarted({ ...msg.payload, turnStartedAt: command.ts })],
      effects: armRanOutOfTime('white', command.ts + msg.payload.whiteMs),
    };
  }
  if (!Move.is(msg) && !ClaimOutOfTime.is(msg)) return null;
  if (clocksPausedAttr.from(state) === 1)
    return conflict('the match is temporarily unavailable');
  if (status !== MATCH_STATUS.playing) {
    return conflict(`match is ${status}`);
  }
  const toMove = playerToMoveAttr.from(state) as Player;
  const bank = bankOf(state, toMove);
  const elapsed = command.ts - turnStartedAtAttr.from(state);
  if (Move.is(msg)) {
    if (identity !== toMove) {
      return conflict(`${toMove} is to move`);
    }
    if (elapsed >= bank) {
      return conflict(REFUSAL.tooLate);
    }
    const left = bank - elapsed;
    const next = opponent(toMove);
    const whiteMs = toMove === 'white' ? left : whiteMsAttr.from(state);
    const blackMs = toMove === 'black' ? left : blackMsAttr.from(state);
    return {
      ok: true,
      events: [
        Moved({
          playerToMove: next,
          whiteMs,
          blackMs,
          turnStartedAt: command.ts,
        }),
      ],
      effects: armRanOutOfTime(
        next,
        command.ts + (next === 'white' ? whiteMs : blackMs)
      ),
    };
  }
  if (msg.payload.player !== toMove || elapsed < bank) {
    return conflict(REFUSAL.timeLeft);
  }
  return {
    ok: true,
    events: [RanOutOfTime({ winner: opponent(toMove) })],
    effects: [CancelScheduleEffect({ id: RAN_OUT_OF_TIME_SCHEDULE_ID })],
  };
}

function recoverMatchEffects(state: RoomState) {
  if (clocksPausedAttr.from(state) === 1)
    return [CancelScheduleEffect({ id: RAN_OUT_OF_TIME_SCHEDULE_ID })];
  const status = matchStatusAttr.from(state);
  if (status === MATCH_STATUS.notStarted) return [];
  if (status === MATCH_STATUS.over)
    return [CancelScheduleEffect({ id: RAN_OUT_OF_TIME_SCHEDULE_ID })];
  const player = playerToMoveAttr.from(state) as Player;
  return armRanOutOfTime(
    player,
    turnStartedAtAttr.from(state) + bankOf(state, player)
  );
}

export const gameRoomModule = defineRoomModule<
  RoomState,
  Message,
  Message,
  string
>({
  name: 'game-room',
  recoverEffects: recoverMatchEffects,
  availabilityChange(state, available, now) {
    if (matchStatusAttr.from(state) !== MATCH_STATUS.playing) return null;
    const event = clockAvailability(
      state,
      available,
      now,
      readPlayerToMove(state)
    );
    if (event === null) return null;
    return {
      events: [event],
      effects: recoverMatchEffects(reduceClockAvailability(state, event)),
    };
  },
  initialState(): RoomState {
    return {
      ...tallyAttr(0),
      ...ownerAttr(null),
      ...turnedAwayAttr([]),
      ...matchStatusAttr(MATCH_STATUS.notStarted),
      ...playerToMoveAttr('white'),
      ...whiteMsAttr(0),
      ...blackMsAttr(0),
      ...turnStartedAtAttr(0),
      ...clocksPausedAttr(0),
      ...winnerAttr(null),
      ...initialNotes(),
    };
  },

  handle(
    state: RoomState,
    command: RoomCommand,
    identity: string
  ): HandleResult {
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) {
      return invalid('not a message');
    }
    if (turnedAwayAttr.from(state).includes(identity)) {
      return unauthorized(REFUSAL.turnedAway);
    }
    if (AddOne.is(msg)) return { ok: true, events: [TallyChanged({ by: 1 })] };
    if (TakeOne.is(msg)) {
      return { ok: true, events: [TallyChanged({ by: -1 })] };
    }
    return (
      handleNote(msg) ??
      handleOwnership(state, msg, identity) ??
      handleMatch(state, command, msg, identity) ??
      invalid(String(msg.type))
    );
  },

  audience: noteAudience,

  reduce(state: RoomState, event: Message): RoomState {
    const noted = reduceNote(state, event);
    if (noted !== null) return noted;
    if (ClockAvailabilityChanged.is(event))
      return reduceClockAvailability(state, event);
    if (TallyChanged.is(event)) {
      return {
        ...state,
        ...tallyAttr(tallyAttr.from(state) + event.payload.by),
      };
    }
    if (RoomClaimed.is(event)) {
      return { ...state, ...ownerAttr(event.payload.owner) };
    }
    if (TurnedAway.is(event)) {
      const away = turnedAwayAttr.from(state);
      if (away.includes(event.payload.person)) return state;
      return {
        ...state,
        ...turnedAwayAttr([...away, event.payload.person].sort()),
      };
    }
    if (MatchStarted.is(event)) {
      return {
        ...state,
        ...matchStatusAttr(MATCH_STATUS.playing),
        ...playerToMoveAttr('white'),
        ...whiteMsAttr(event.payload.whiteMs),
        ...blackMsAttr(event.payload.blackMs),
        ...turnStartedAtAttr(event.payload.turnStartedAt),
        ...winnerAttr(null),
      };
    }
    if (Moved.is(event)) {
      return {
        ...state,
        ...playerToMoveAttr(event.payload.playerToMove),
        ...whiteMsAttr(event.payload.whiteMs),
        ...blackMsAttr(event.payload.blackMs),
        ...turnStartedAtAttr(event.payload.turnStartedAt),
      };
    }
    if (RanOutOfTime.is(event)) {
      return {
        ...state,
        ...matchStatusAttr(MATCH_STATUS.over),
        ...winnerAttr(event.payload.winner),
      };
    }
    return state;
  },
});

/** The tally everyone in the room shares. */
export function readTally(state: RoomState): number {
  return tallyAttr.from(state);
}

/** The room's owner, or null while nobody has claimed it. */
export function readOwner(state: RoomState): string | null {
  return ownerAttr.from(state);
}

/** Everyone the owner has turned away, sorted. */
export function readTurnedAway(state: RoomState): readonly string[] {
  return turnedAwayAttr.from(state) as readonly string[];
}

export function readMatchStatus(state: RoomState): MatchStatus {
  return matchStatusAttr.from(state) as MatchStatus;
}

export function readPlayerToMove(state: RoomState): Player {
  return playerToMoveAttr.from(state) as Player;
}

/** The player who won on time, or null while nobody has. */
export function readWinner(state: RoomState): Player | null {
  return winnerAttr.from(state) as Player | null;
}

/**
 * A player's time left at `now`, in whole seconds rounded up, as a match
 * clock shows it: the player to move's time runs down while the match is
 * playing and is 0 once it is over; the other player's time stands still.
 */
export function readTimeLeftSeconds(
  state: RoomState,
  player: Player,
  now: number
): number {
  const status = readMatchStatus(state);
  const toMove = readPlayerToMove(state);
  const bank = bankOf(state, player);
  if (
    clocksPausedAttr.from(state) === 1 ||
    player !== toMove ||
    status === MATCH_STATUS.notStarted
  ) {
    return Math.ceil(bank / 1000);
  }
  if (status === MATCH_STATUS.over) return 0;
  const left = bank - (now - turnStartedAtAttr.from(state));
  return Math.max(0, Math.ceil(left / 1000));
}

/** Whether the host has paused the shared match independently of its players. */
export function readClocksPaused(state: RoomState): boolean {
  return (
    clocksPausedAttr.from(state) === 1 &&
    readMatchStatus(state) === MATCH_STATUS.playing
  );
}
