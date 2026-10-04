import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { chooseCustomGameBotMove } from '@libs/chess-custom-game-harness/custom-game-bot-choice';
import { redeliverCustomGameBotWake } from '@libs/chess-custom-game-harness/custom-game-bot-wakes';
import { CUSTOM_GAME_FOOLS_MATE } from '@libs/chess-custom-game-harness/custom-game-histories';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  partition,
  restoreActorConnection,
} from '@libs/harness/actions';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { customPeople } from '../steps/custom-game-world';
import {
  CUSTOM_MODEL_OBSERVER,
  customModelGame,
  playCustomModelMove,
  prepareCustomGameModel,
  readCustomModelShown,
} from './custom-game-model-world';
import terminalConfirmationTrace from './fixtures/custom-game-terminal-confirmation.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game-control',
  traces: 64,
  maxSteps: 16,
  timeoutMs: 180_000,
  regressions: [
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
      await w.s.apply(chooseCustomGameBotMove, CUSTOM_MODEL_OBSERVER, uci);
      await w.s.advanceTime(1_000);
    },
    resignControlledGame: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'resign',
      }),
    cancelControlledGame: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'cancel',
      }),
    _wrongBot: (w) =>
      w.s.apply(redeliverCustomGameBotWake, CUSTOM_MODEL_OBSERVER, 'wrong'),
    _staleBot: (w) =>
      w.s.apply(redeliverCustomGameBotWake, CUSTOM_MODEL_OBSERVER, 'stale'),
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
