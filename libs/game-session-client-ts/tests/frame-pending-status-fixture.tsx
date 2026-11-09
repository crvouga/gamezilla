import type { CustomGameScreenModel } from '@libs/game-session-client-ts/use-custom-game-screen';
import {
  type CustomGame,
  type CustomGameSide,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';
import { TurnGamesProvider } from '@pkgs/turn-game-client-ts/turn-games-context';
import { boardOnly, fixedPlayers } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSignal, type JSX } from 'solid-js';

/** Deferred model boundary: exercises production status derivation, not transport. */
export function pendingFrameModel() {
  const initial: CustomGame = {
    ...newCustomGame('pending-frame', 'alice', 'fixture:4'),
    status: 'active',
    black: { kind: 'local', person: '' },
  };
  const [current, setCurrent] = createSignal(initial);
  const [submitting, setSubmitting] = createSignal(false);
  const [mySide, setMySide] = createSignal<CustomGameSide | null>('white');
  const [error, setError] = createSignal('');
  const model = {
    current,
    submitting,
    mySide,
    error,
    canPlay: () => true,
    canSubmit: () => true,
    movesWait: () => false,
  } as unknown as CustomGameScreenModel;
  const submit = async (completion: Promise<void>) => {
    setError('');
    setSubmitting(true);
    try {
      await completion;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Refused');
    } finally {
      setSubmitting(false);
    }
  };
  return { initial, model, setCurrent, setMySide, submit };
}

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
const rules = {
  forPosition: () => ({ id: 'fixture' }),
  capability: () => undefined,
} as unknown as TurnGames;
const presentation: GamePresentation<JSX.Element> = {
  id: 'fixture',
  name: () => 'Reference game',
  canFlip: true,
  Board: () => null,
  sideLabel: (side) => side,
  endingDescription: (reason) => reason,
  endingLabel: (reason) => reason,
  frame: {
    drawOffers: true,
    players: fixedPlayers(2),
    options: [],
    seats: {
      look: () => ({ color: 1, mark: 'Pawn' }),
      stat: () => null,
      facts: () => [],
      out: () => false,
    },
    createBoard: boardOnly(() => null),
    turnStatus: (_, viewer) =>
      viewer === 'white' ? 'Your turn.' : 'White to move.',
    result: () => ({ scoreLabel: null, standings: [] }),
  },
};

export function renderPendingFrame(children: () => JSX.Element) {
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
