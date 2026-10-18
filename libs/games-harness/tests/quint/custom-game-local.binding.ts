import { chooseCustomGameBotMove } from '@libs/game-session-harness/custom-game-bots';
import { operateCustomGame } from '@libs/game-session-harness/custom-game-controls';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-probe';
import {
  attemptCustomGameChoice,
  configureCustomGameChoice,
} from '@libs/game-session-harness/custom-game-ui';
import { openCustomGames } from '@libs/game-session-harness/game-navigation';
import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared/custom-game-choice';
import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { modelSpaceLink, openModelSpace } from './custom-game-model-world';
import { modelGameOf, modelSide, victoryMoveAt } from './model-game';

/** The host's choice, which the scenario relies on being accepted. */
function hostChooses(w: QuintHarnessWorld, input: CustomGameInput) {
  return w.s.apply(configureCustomGameChoice, 'alice', input);
}

async function hostGame(w: QuintHarnessWorld) {
  const game = (await w.s.read(readCustomGameProbe, 'alice'))?.current;
  if (game === null || game === undefined)
    throw new Error('Alice has no custom game');
  return game;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game-local',
  traces: 32,
  maxSteps: 16,
  timeoutMs: 180_000,
  actions: {
    init: async (w, picks) => {
      await openModelSpace(w, 'alice', ['bob']);
      if (picks['beginning'] !== 'playing') return;
      await hostChooses(w, { operation: 'create' });
      await hostChooses(w, { operation: 'bot', side: 'black' });
      await hostChooses(w, { operation: 'ready' });
      await hostChooses(w, { operation: 'start' });
    },
    createGame: (w) => hostChooses(w, { operation: 'create' }),
    assignBot: (w) => hostChooses(w, { operation: 'bot', side: 'black' }),
    becomeReady: (w) => hostChooses(w, { operation: 'ready' }),
    startGame: (w) => hostChooses(w, { operation: 'start' }),
    // The victory's next move, which four moves never finish.
    playCustomMove: async (w) => {
      const game = await hostGame(w);
      const choice: CustomGameChoice = {
        operation: 'move',
        gameId: game.id,
        revision: game.revision,
        ply: game.moves.length,
        uci: victoryMoveAt(w, game.moves.length),
      };
      w.memo.set('local-game-last-move', choice);
      await w.s.apply(attemptCustomGameChoice, 'alice', choice);
    },
    // The bot answers with the victory's next move, one the game allows.
    botPlays: async (w) => {
      const game = await hostGame(w);
      await w.s.apply(
        chooseCustomGameBotMove,
        'alice',
        victoryMoveAt(w, game.moves.length)
      );
      await w.s.advanceTime(1000);
    },
    cancelCustomGame: (w) =>
      w.s.apply(operateCustomGame, 'alice', { operation: 'cancel' }),
    resignCustomGame: (w) =>
      w.s.apply(operateCustomGame, 'alice', { operation: 'resign' }),
    _loseConnection: (w, picks) => w.s.apply(partition, String(picks['actor'])),
    _connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['actor'])),
    _reopenApp: async (w) => {
      await w.s.apply(restartApp, 'alice');
      if ((await w.s.read(readCustomGameProbe, 'alice')) !== null) return;
      await w.s.apply(reopenSpaceLink, 'alice', modelSpaceLink(w));
      await w.s.apply(openCustomGames, 'alice', modelGameOf(w).shared.id);
    },
    _repeatMove: async (w) => {
      const choice = w.memo.get('local-game-last-move') as
        | CustomGameChoice
        | undefined;
      if (choice !== undefined)
        await w.s.apply(attemptCustomGameChoice, 'alice', choice);
    },
  },
  observe: async (w) => {
    const host = await w.quiet.read(readCustomGameProbe, 'alice');
    const guest = await w.quiet.read(readCustomGameProbe, 'bob');
    const game = host?.current;
    if (host === null) throw new Error('Alice cannot see her custom games');
    return {
      status: game?.status ?? 'none',
      movesPlayed: game?.moves.length ?? 0,
      sideToMove: modelSide(game?.turn ?? 'white'),
      secondSide: game?.black.kind ?? 'open',
      ready: game?.ready.includes('white') ?? false,
      movesShown: new Map([
        ['alice', game?.moves.length ?? 0],
        ['bob', guest === null ? -1 : (guest.current?.moves.length ?? 0)],
      ]),
    };
  },
});
