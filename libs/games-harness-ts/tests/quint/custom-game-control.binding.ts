import { redeliverCustomGameBotWake } from '@libs/game-session-harness-ts/custom-game-bot-wakes';
import { chooseCustomGameBotMove } from '@libs/game-session-harness-ts/custom-game-bots';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import {
  changeCustomModelChoice,
  customModelGame,
  modelPeople,
  playCustomModelMove,
  prepareCustomGameModel,
  readCustomModelShown,
} from './custom-game-model-world';
import retainedBoard from './fixtures/custom-game-reconnect-keeps-host-offline-board.itf.json';
import offlineCancel from './fixtures/custom-game-stale-wake-after-offline-cancel.itf.json';
import offlineMove from './fixtures/custom-game-stale-wake-after-offline-move.itf.json';
import terminalConfirmationTrace from './fixtures/custom-game-terminal-confirmation.itf.json';
import { modelResult, modelSide, victoryMoveAt } from './model-game';

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
        firstSideBot: picks['firstSideBot'] === true,
        secondSideBot: picks['secondSideBot'] === true,
      }),
    playCustomMove: (w, picks) =>
      playCustomModelMove(w, String(picks['actor'])),
    // The bot's choice is the victory's next move, one the game allows.
    botPlays: async (w) => {
      const game = await customModelGame(w);
      await w.s.apply(
        chooseCustomGameBotMove,
        'alice',
        victoryMoveAt(w, game.moves.length)
      );
      await w.s.advanceTime(1_000);
    },
    resignCustomGame: (w, picks) =>
      changeCustomModelChoice(w, String(picks['actor']), {
        operation: 'resign',
      }),
    cancelCustomGame: (w, picks) =>
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
    const participants = new Map<string, string>();
    for (const side of ['white', 'black'] as const) {
      const participant = game[side];
      participants.set(
        modelSide(side),
        participant.kind === 'bot'
          ? 'bot'
          : ([...modelPeople(w)].find(
              ([, id]) => id === participant.person
            )?.[0] ?? 'unknown')
      );
    }
    return {
      participants,
      status: game.status,
      movesPlayed: game.moves.length,
      sideToMove: modelSide(game.turn),
      result: modelResult(game.outcome),
      playShown: await readCustomModelShown(w),
    };
  },
});
