import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  establishPongLocalStage,
  finishLocalPong,
  startLocalPong,
} from '@libs/pong-harness-ts/pong-local-actions';
import {
  type PongLocalOpponent,
  pongLocalView,
} from '@libs/pong-harness-ts/pong-local-view';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'pong-local-play',
  traces: 16,
  maxSteps: 12,
  actions: {
    init: (w, picks) =>
      w.s.apply(establishPongLocalStage, {
        opponent: picks['opponent'] as PongLocalOpponent,
        stage: 'ready',
      }),
    startLocalPong: (w) => w.s.apply(startLocalPong),
    loseConnection: (w) => w.s.apply(partition, 'alice'),
    connectionReturns: (w) => w.s.apply(restoreActorConnection, 'alice'),
    finishLocalPong: (w) => w.s.apply(finishLocalPong),
    reopenApp: (w) => w.s.apply(restartApp, 'alice'),
  },
  observe: async (w) => {
    const view = await w.quiet.read(pongLocalView);
    return {
      localOpponent: view.localOpponent,
      localStage: view.localStage,
      gameShown: view.gameShown,
      controlledPaddles: new Set(view.controlledPaddles),
    };
  },
});
