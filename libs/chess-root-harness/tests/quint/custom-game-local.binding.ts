import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { chooseCustomGameBotMove } from '@libs/game-session-harness/custom-game-bots';
import {
  attemptCustomGameChoice,
  readCustomGameProbe,
} from '@libs/game-session-harness/custom-game-ui';
import type { CustomGameChoice } from '@libs/game-session-shared/custom-game-choice';
import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import {
  customFact,
  customScreen,
  customSpace,
} from '../steps/custom-game-world';

const OPENING = ['e2e4', 'e7e5', 'g1f3', 'b8c6'] as const;

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game-local',
  traces: 32,
  maxSteps: 16,
  timeoutMs: 180_000,
  actions: {
    init: async (w, picks) => {
      await customSpace(w, 'alice', ['bob']);
      if (picks['beginning'] !== 'playing') return;
      await customFact(w, 'alice', { operation: 'create' });
      await customFact(w, 'alice', { operation: 'bot', side: 'black' });
      await customFact(w, 'alice', { operation: 'ready' });
      await customFact(w, 'alice', { operation: 'start' });
    },
    createGame: (w) => customFact(w, 'alice', { operation: 'create' }),
    assignBot: (w) =>
      customFact(w, 'alice', { operation: 'bot', side: 'black' }),
    becomeReady: (w) => customFact(w, 'alice', { operation: 'ready' }),
    startGame: (w) => customFact(w, 'alice', { operation: 'start' }),
    playCustomMove: async (w) => {
      const game = (await w.s.read(readCustomGameProbe, 'alice'))?.current;
      if (game === null || game === undefined)
        throw new Error('Alice has no game');
      const choice: CustomGameChoice = {
        operation: 'move',
        gameId: game.id,
        revision: game.revision,
        ply: game.moves.length,
        uci: OPENING[game.moves.length] ?? 'e2e4',
      };
      w.memo.set('local-game-last-move', choice);
      await w.s.apply(attemptCustomGameChoice, 'alice', choice);
    },
    botPlays: async (w) => {
      const game = (await w.s.read(readCustomGameProbe, 'alice'))?.current;
      if (game === null || game === undefined)
        throw new Error('Alice has no game');
      await w.s.apply(
        chooseCustomGameBotMove,
        'alice',
        OPENING[game.moves.length] ?? 'e7e5'
      );
      await w.s.advanceTime(1000);
    },
    cancelCustomGame: (w) =>
      w.s.apply(changeCustomGame, 'alice', { operation: 'cancel' }),
    resignCustomGame: (w) =>
      w.s.apply(changeCustomGame, 'alice', { operation: 'resign' }),
    _loseConnection: (w, picks) => w.s.apply(partition, String(picks['actor'])),
    _connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['actor'])),
    _reopenApp: async (w) => {
      await w.s.apply(restartApp, 'alice');
      await customScreen(w, 'alice');
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
    if (host === null) throw new Error('Alice cannot see her local game');
    return {
      controlledStatus: game?.status ?? 'none',
      controlledPly: game?.moves.length ?? 0,
      controlledTurn: game?.turn ?? 'white',
      black: game?.black.kind ?? 'open',
      ready: game?.ready.includes('white') ?? false,
      shownMoves: new Map([
        ['alice', game?.moves.length ?? 0],
        ['bob', guest === null ? -1 : (guest.current?.moves.length ?? 0)],
      ]),
    };
  },
});
