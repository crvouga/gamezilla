import { asKeyword } from '@pkgs/keyword';
import {
  createMessageNamespace,
  isPlainRecord,
  type Message,
} from '@pkgs/message';
import {
  assertRoomModuleName,
  type HandleResult,
  hashRoomState,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';

/**
 * Mouse-movement shaped fixture: every command moves one player's cursor;
 * state holds a nested positions map (spread-copied on every reduce, the
 * way product modules are written).
 */
export const POSITIONS_KEY = asKeyword('cursor/positions');
export const MOVES_KEY = asKeyword('cursor/moves');

type Vec = { x: number; y: number };

function isVec(p: unknown): p is Vec {
  return (
    isPlainRecord(p) && typeof p['x'] === 'number' && typeof p['y'] === 'number'
  );
}

function isMoved(p: unknown): p is Vec & { id: string } {
  return isVec(p) && typeof (p as { id?: unknown }).id === 'string';
}

const cmd = createMessageNamespace('cursor-cmd');
const evt = createMessageNamespace('cursor-evt');

export const Move = cmd('move', isVec);
export const Moved = evt('moved', isMoved);

export function readPositions(state: RoomState): Record<string, Vec> {
  return (state[POSITIONS_KEY] as Record<string, Vec> | undefined) ?? {};
}

export function readMoves(state: RoomState): number {
  return (state[MOVES_KEY] as number | undefined) ?? 0;
}

export const CursorModule: RoomModule<RoomState, Message, Message, string> = {
  name: assertRoomModuleName('cursor'),
  initialState: () => ({ [POSITIONS_KEY]: {}, [MOVES_KEY]: 0 }),
  handle(_state, command: RoomCommand, identity): HandleResult {
    const msg = command.payload;
    if (Move.is(msg)) {
      return {
        ok: true,
        events: [Moved({ id: identity, x: msg.payload.x, y: msg.payload.y })],
      };
    }
    return {
      ok: false,
      error: { type: ROOM_ERROR_TYPE.invalidCommand, reason: String(msg.type) },
    };
  },
  reduce(state, event): RoomState {
    if (!Moved.is(event)) return state;
    const { id, x, y } = event.payload;
    return {
      ...state,
      [POSITIONS_KEY]: { ...readPositions(state), [id]: { x, y } },
      [MOVES_KEY]: readMoves(state) + 1,
    };
  },
  hash: hashRoomState,
};
