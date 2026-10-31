import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';
import { TurnGamesProvider } from '@pkgs/turn-game-client-ts/turn-games-context';
import {
  boardOnly,
  fixedPlayers,
  type GameFrame,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import type { JSX } from 'solid-js';

export const MATCH: MultiplayerGame = {
  id: 'match',
  white_id: 'alice',
  black_id: 'bob',
  fen: 'fixture:live',
  pgn: '',
  revision: 2,
  turn: 'alice',
  outcome: 'ongoing',
  reason: null,
  time_control: null,
  white_ms: null,
  black_ms: null,
  clock_at_ms: null,
  paused_at_ms: null,
  draw_offer_by: null,
  rematch_offer_by: null,
  rematch_of: null,
  white_rating: null,
  black_rating: null,
  white_rating_diff: null,
  black_rating_diff: null,
  setup_ready: null,
};

export const VIEWER = {
  myId: 'alice',
  participant: true,
  opponentName: 'Bob',
  opponentRating: '1500',
};

/** Only profile reads are needed; no server or full application is mounted. */
const engine = {
  watch: () => ({
    getSnapshot: () => [],
    getHydrated: () => true,
    subscribe: () => () => undefined,
  }),
  status: {
    getSnapshot: () => INITIAL_SYNC_STATUS,
    subscribe: () => () => undefined,
  },
} as unknown as SyncEngine;

export function frameFixture(
  overrides: Partial<GameFrame<JSX.Element>> = {},
  seats: Partial<GameFrame<JSX.Element>['seats']> = {}
): GameFrame<JSX.Element> {
  return {
    players: fixedPlayers(2),
    options: [],
    seats: {
      look: () => ({ color: 1, mark: 'Pawn' }),
      stat: () => null,
      facts: () => [],
      out: () => false,
      ...seats,
    },
    createBoard: boardOnly(() => null),
    turnStatus: () => null,
    result: () => ({ scoreLabel: null, standings: [] }),
    ...overrides,
  };
}

export function renderMatchFrame(
  frame: GameFrame<JSX.Element>,
  children: () => JSX.Element
) {
  const presentation: GamePresentation<JSX.Element> = {
    id: 'fixture',
    name: () => 'Fleet',
    canFlip: true,
    Board: () => null,
    sideLabel: (side) => side,
    frame,
    endingDescription: (reason) => reason,
    endingLabel: (reason) => reason,
  };
  const rules = {
    forPosition: () => ({ id: 'fixture' }),
  } as unknown as TurnGames;
  return renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <ModerationProvider rules={shippedModerationRules()}>
        <SyncEngineProvider value={engine}>
          <TurnGamesProvider rules={rules} presentations={[presentation]}>
            {children()}
          </TurnGamesProvider>
        </SyncEngineProvider>
      </ModerationProvider>
    </ThemeProvider>
  ));
}
