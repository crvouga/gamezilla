import { createAttrNamespace } from '@pkgs/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@pkgs/message';
import type { HandleResult, RoomState } from '@pkgs/room';

export const CHESS_SCREEN = {
  root: 'root',
  puzzle: 'puzzle',
  settings: 'settings',
  settingsDeveloper: 'settings-developer',
  settingsDeveloperUi: 'settings-developer-ui',
  settingsDeveloperUiDetail: 'settings-developer-ui-detail',
};

export type ChessMainMenuScreen =
  (typeof CHESS_SCREEN)[keyof typeof CHESS_SCREEN];

const ALL_SCREENS = new Set<string>(Object.values(CHESS_SCREEN));

function readChessMainMenuScreen(v: unknown): ChessMainMenuScreen {
  if (typeof v === 'string' && ALL_SCREENS.has(v)) {
    return v as ChessMainMenuScreen;
  }
  return CHESS_SCREEN.root;
}

function readSelectedUiComponentName(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const gamesNs = createAttrNamespace('chess', 'main-menu');

/** Room keys for the chess in-space main menu (sub-screen under `games/selected === chess`). */
export const ChessMainMenuScreenAttr = {
  screen: gamesNs('screen', readChessMainMenuScreen),
  selectedUiComponentName: gamesNs(
    'selected-ui-component-name',
    readSelectedUiComponentName
  ),
} as const;

function isChessMainMenuScreen(v: unknown): v is ChessMainMenuScreen {
  return typeof v === 'string' && ALL_SCREENS.has(v);
}

function validateSetChessMainMenuScreenPayload(
  payload: unknown
): payload is { screen: ChessMainMenuScreen } {
  if (!isPlainRecord(payload)) return false;
  if (!('screen' in payload)) return false;
  return isChessMainMenuScreen(payload['screen']);
}

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
export const SetChessMainMenuScreen = chessCmdNs(
  'set-main-menu-screen',
  validateSetChessMainMenuScreenPayload
);
export const SetChessSelectedUiComponent = chessCmdNs(
  'set-selected-ui-component',
  validateSetChessSelectedUiComponentPayload
);

export const chessEvtNs = createMessageNamespace('chess-evt');
export const ChessMainMenuScreenSet = chessEvtNs(
  'main-menu-screen-set',
  validateSetChessMainMenuScreenPayload
);
export const ChessSelectedUiComponentSet = chessEvtNs(
  'selected-ui-component-set',
  validateSetChessSelectedUiComponentPayload
);

export const chessMainMenuCommandRouter = createMessageRouter<
  RoomState,
  string,
  HandleResult
>(chessCmdNs)
  .on(SetChessMainMenuScreen, (_state, _identity, cmd) => ({
    ok: true,
    events: [ChessMainMenuScreenSet({ screen: cmd.payload.screen })],
  }))
  .on(SetChessSelectedUiComponent, (_state, _identity, cmd) => ({
    ok: true,
    events: [ChessSelectedUiComponentSet({ name: cmd.payload.name })],
  }));

export const chessMainMenuEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessEvtNs)
  .on(ChessMainMenuScreenSet, (state, _identity, ev) => ({
    ...state,
    ...ChessMainMenuScreenAttr.screen(ev.payload.screen),
  }))
  .on(ChessSelectedUiComponentSet, (state, _identity, ev) => ({
    ...state,
    ...ChessMainMenuScreenAttr.selectedUiComponentName(ev.payload.name),
  }));
