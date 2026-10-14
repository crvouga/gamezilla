import { chooseCustomGameBotMove } from '@libs/chess-custom-game-harness/custom-game-bot-choice';
import { redeliverCustomGameBotWake } from '@libs/chess-custom-game-harness/custom-game-bot-wakes';
import { CUSTOM_GAME_FOOLS_MATE } from '@libs/chess-custom-game-harness/custom-game-histories';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { customPeople } from '../steps/custom-game-world';
import {
  changeCustomModelChoice,
  customModelGame,
  playCustomModelMove,
  prepareCustomGameModel,
  readCustomModelShown,
} from './custom-game-model-world';
import retainedBoard from './fixtures/custom-game-reconnect-keeps-host-offline-board.itf.json';
import offlineCancel from './fixtures/custom-game-stale-wake-after-offline-cancel.itf.json';
import offlineMove from './fixtures/custom-game-stale-wake-after-offline-move.itf.json';
import terminalConfirmationTrace from './fixtures/custom-game-terminal-confirmation.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game-control',
  traces: 64,
  maxSteps: 16,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: custom-game-reconnect-keeps-host-offline-board
      id: 'custom-game-reconnect-keeps-host-offline-board',
      title:
        'A returning guest keeps the active board while the host is offline',
      seed: '0x67932',
      itf: retainedBoard,
    },

    {
      // regression: custom-game-stale-wake-after-offline-cancel
      id: 'custom-game-stale-wake-after-offline-cancel',
      title: 'A stale wake stays stale after the offline host cancels',
      seed: '0x67932',
      itf: offlineCancel,
    },
    {
      // regression: custom-game-stale-wake-after-offline-move
      id: 'custom-game-stale-wake-after-offline-move',
      title: 'A stale wake stays stale when the offline host has another move',
      seed: '0x67932',
      itf: offlineMove,
    },

    // regression: custom-game-terminal-confirmation
    {
      id: 'custom-game-terminal-confirmation',
      title: 'Repeating resignation after the game ends hears a refusal',
      seed: '0x67932',
      itf: terminalConfirmationTrace,
    },
  ],
  actions: {
    init: (w, picks) =>
      prepareCustomGameModel(w, {
        timed: false,
        whiteBot: picks['whiteBot'] === true,
        blackBot: picks['blackBot'] === true,
      }),
    playControlledMove: (w, picks) =>
      playCustomModelMove(w, String(picks['actor'])),
    botPlays: async (w) => {
      const game = await customModelGame(w);
      const uci = CUSTOM_GAME_FOOLS_MATE[game.moves.length];
      if (uci === undefined)
        throw new Error('No allowed continuation in the completed game');
      await w.s.apply(chooseCustomGameBotMove, 'alice', uci);
      await w.s.advanceTime(1_000);
    },
    resignControlledGame: (w, picks) =>
      changeCustomModelChoice(w, String(picks['actor']), {
        operation: 'resign',
      }),
    cancelControlledGame: (w, picks) =>
      changeCustomModelChoice(w, String(picks['actor']), {
        operation: 'cancel',
      }),
    _wrongBot: (w) => w.s.apply(redeliverCustomGameBotWake, 'alice', 'wrong'),
    _staleBot: (w) => w.s.apply(redeliverCustomGameBotWake, 'alice', 'stale'),
    _loseConnection: (w, picks) => w.s.apply(partition, String(picks['actor'])),
    _connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['actor'])),
  },
  observe: async (w) => {
    const game = await customModelGame(w);
    const controllers = new Map<string, string>();
    for (const side of ['white', 'black'] as const) {
      const participant = game[side];
      controllers.set(
        side,
        participant.kind === 'bot'
          ? 'bot'
          : ([...customPeople(w)].find(
              ([, id]) => id === participant.person
            )?.[0] ?? 'unknown')
      );
    }
    return {
      controllers,
      controlledStatus: game.status,
      controlledPly: game.moves.length,
      controlledTurn: game.turn,
      controlledOutcome: game.outcome,
      controlledShown: await readCustomModelShown(w),
    };
  },
});
