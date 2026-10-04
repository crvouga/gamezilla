import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameSeconds } from '@libs/chess-custom-game-harness/custom-game-clocks';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  partition,
  restoreActorConnection,
} from '@libs/harness/actions';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import {
  CUSTOM_MODEL_OBSERVER,
  customModelGame,
  playCustomModelMove,
  prepareCustomGameModel,
  readCustomModelShown,
  repeatCustomModelMove,
} from './custom-game-model-world';
import observationTrace from './fixtures/custom-game-observation-spends-time.itf.json';
import partitionTrace from './fixtures/custom-game-partition-spends-time.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game-play',
  traces: 32,
  maxSteps: 16,
  timeoutMs: 180_000,
  regressions: [
    // regression: custom-game-observation-spends-time
    {
      id: 'custom-game-observation-spends-time',
      title: 'Observing a game spends no participant time',
      seed: '0x67932',
      itf: observationTrace,
    },
    // regression: custom-game-partition-spends-time
    {
      id: 'custom-game-partition-spends-time',
      title: 'An offline watcher retains the board before the next heartbeat',
      seed: '0x67932',
      itf: partitionTrace,
    },
  ],
  actions: {
    init: (w) => prepareCustomGameModel(w, { timed: true }),
    playCustomMove: (w, picks) =>
      playCustomModelMove(w, String(picks['actor'])),
    resignCustomGame: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'resign',
      }),
    cancelCustomGame: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'cancel',
      }),
    customTimePasses: (w, picks) =>
      w.s.advanceTime(Number(picks['quarters']) * 15_000),
    _illegalMove: async (w, picks) => {
      const actor = String(picks['actor']);
      const game = await customModelGame(w, actor);
      await w.s.apply(changeCustomGame, actor, {
        operation: 'move',
        uci: 'e2e5',
        ply: game.moves.length,
      });
    },
    _repeatMove: repeatCustomModelMove,
    _changeStartedGame: (w) =>
      w.s.apply(changeCustomGame, 'alice', {
        operation: 'clock',
        minutes: 5,
        increment: 2,
      }),
    _loseConnection: (w, picks) => w.s.apply(partition, String(picks['actor'])),
    _connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['actor'])),
  },
  observe: async (w) => {
    const game = await customModelGame(w);
    const clockLeft = new Map<string, number>();
    for (const side of ['white', 'black'] as const)
      clockLeft.set(
        side,
        (await w.quiet.read(
          readCustomGameSeconds,
          CUSTOM_MODEL_OBSERVER,
          side
        )) / 15
      );
    return {
      playStatus: game.status,
      ply: game.moves.length,
      sideToMove: game.turn,
      result: game.outcome,
      clockLeft,
      playShown: await readCustomModelShown(w),
    };
  },
});
