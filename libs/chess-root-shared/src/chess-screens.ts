import type { GameCommandContext } from '@libs/spaces-shared/game';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

/**
 * Chess's own screens in the space-wide game screen: its developer tools.
 * The game's choices, its settings entry and the shared puzzle, custom-game,
 * opponent and history screens belong to the platform.
 */
export const CHESS_SCREEN = {
  settings: 'settings',
  settingsDeveloper: 'settings-developer',
  settingsDeveloperPuzzles: 'settings-developer-puzzles',
  settingsDeveloperUi: 'settings-developer-ui',
  settingsDeveloperUiDetail: 'settings-developer-ui-detail',
};

function readSelectedUiComponentName(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const gamesNs = createAttrNamespace('chess', 'main-menu');

/** Room keys for what chess's own screens have selected. */
export const ChessScreensAttr = {
  selectedUiComponentName: gamesNs.textOrNull(
    'selected-ui-component-name',
    readSelectedUiComponentName
  ),
} as const;

function validateSetChessSelectedUiComponentPayload(
  payload: unknown
): payload is { name: string | null } {
  if (!isPlainRecord(payload)) return false;
  if (!('name' in payload)) return false;
  const n = payload['name'];
  if (n === null) return true;
  if (typeof n !== 'string') return false;
  return n.trim().length > 0;
}

export const chessCmdNs = createMessageNamespace('chess-cmd');
export const SetChessSelectedUiComponent = chessCmdNs(
  'set-selected-ui-component',
  validateSetChessSelectedUiComponentPayload
);

export const chessEvtNs = createMessageNamespace('chess-evt');
export const ChessSelectedUiComponentSet = chessEvtNs(
  'selected-ui-component-set',
  validateSetChessSelectedUiComponentPayload
);

export const chessScreensCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(chessCmdNs).on(SetChessSelectedUiComponent, (_state, _identity, cmd) => ({
  ok: true,
  events: [ChessSelectedUiComponentSet({ name: cmd.payload.name })],
}));

export const chessScreensEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessEvtNs).on(ChessSelectedUiComponentSet, (state, _identity, ev) => ({
  ...state,
  ...ChessScreensAttr.selectedUiComponentName(ev.payload.name),
}));
