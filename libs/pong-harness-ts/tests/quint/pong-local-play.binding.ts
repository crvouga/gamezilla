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
  pongLocalCourts,
  prepareLocalPongViewer,
} from '@libs/pong-harness-ts/pong-local-courts';
import type { PongLocalOpponent } from '@libs/pong-harness-ts/pong-local-view';
import {
  guideSharedPong,
  joinSharedPong,
} from '@libs/pong-harness-ts/pong-shared-actions';
import type { PongPlace } from '@libs/pong-harness-ts/pong-shared-view';
import type { PongPaddle } from '@libs/pong-harness-ts/pong-view';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import reopenAfterGuidance from './fixtures/pong-local-reopen-after-paddle-guidance.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'pong-local-play',
  traces: 16,
  maxSteps: 12,
  regressions: [
    {
      // regression: pong-local-reopen-after-paddle-guidance
      id: 'pong-local-reopen-after-paddle-guidance',
      title: 'Reopening after guiding a local paddle keeps the ongoing game',
      seed: '0x67932',
      itf: reopenAfterGuidance,
    },
  ],
  actions: {
    init: async (w, picks) => {
      await w.s.apply(establishPongLocalStage, {
        opponent: picks['opponent'] as PongLocalOpponent,
        stage: 'ready',
      });
      await w.s.apply(prepareLocalPongViewer);
    },
    startLocalPong: (w) => w.s.apply(startLocalPong),
    loseConnection: (w) => w.s.apply(partition, 'alice'),
    connectionReturns: (w) => w.s.apply(restoreActorConnection, 'alice'),
    joinSpace: (w) => w.s.apply(joinSharedPong),
    guidePaddle: (w, picks) =>
      w.s.apply(
        guideSharedPong,
        picks['person'] as string,
        picks['paddle'] as PongPaddle,
        picks['place'] as PongPlace
      ),
    viewerLosesConnection: (w) => w.s.apply(partition, 'carol'),
    viewerConnectionReturns: (w) => w.s.apply(restoreActorConnection, 'carol'),
    finishLocalPong: (w) => w.s.apply(finishLocalPong),
    reopenApp: (w) => w.s.apply(restartApp, 'alice'),
  },
  observe: (w) => w.quiet.read(pongLocalCourts),
});
