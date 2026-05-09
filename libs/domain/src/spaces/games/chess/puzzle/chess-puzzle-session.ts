import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

function readSelectedPuzzleId(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const sessionNs = createAttrNamespace('chess', 'puzzle-session');

/** Room keys for the in-space chess puzzle picker / play session. */
export const ChessPuzzleSessionAttr = {
  selectedPuzzleId: sessionNs('selected-puzzle-id', readSelectedPuzzleId),
} as const;

function validateSelectChessPuzzlePayload(
  payload: unknown
): payload is { puzzleId: string | null } {
  if (!isPlainRecord(payload)) return false;
  if (!('puzzleId' in payload)) return false;
  const id = payload['puzzleId'];
  if (id === null) return true;
  if (typeof id !== 'string') return false;
  return id.trim().length > 0;
}

export const chessPuzzleSessionCmdNs = createMessageNamespace(
  'chess-puzzle-session-cmd'
);
export const SelectChessPuzzle = chessPuzzleSessionCmdNs(
  'select-puzzle',
  validateSelectChessPuzzlePayload
);

export const chessPuzzleSessionEvtNs = createMessageNamespace(
  'chess-puzzle-session-evt'
);
export const ChessPuzzleSelected = chessPuzzleSessionEvtNs(
  'puzzle-selected',
  validateSelectChessPuzzlePayload
);

export const chessPuzzleSessionCommandRouter = createMessageRouter<
  RoomState,
  string,
  HandleResult
>(chessPuzzleSessionCmdNs).on(SelectChessPuzzle, (_state, _identity, cmd) => ({
  ok: true,
  events: [ChessPuzzleSelected({ puzzleId: cmd.payload.puzzleId })],
}));

export const chessPuzzleSessionEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessPuzzleSessionEvtNs).on(ChessPuzzleSelected, (state, _identity, ev) => ({
  ...state,
  ...ChessPuzzleSessionAttr.selectedPuzzleId(ev.payload.puzzleId),
}));
