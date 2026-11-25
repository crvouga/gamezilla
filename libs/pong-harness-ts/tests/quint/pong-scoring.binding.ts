import { restartApp } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  establishLocalPong,
  finishPongCountdown,
  winPongPoint,
} from '@libs/pong-harness-ts/pong-actions';
import { pongMoveListOffered } from '@libs/pong-harness-ts/pong-controls-view';
import {
  type PongPaddle,
  pongScoreboard,
} from '@libs/pong-harness-ts/pong-view';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import scoringAfterLongRally from './fixtures/pong-scoring-after-long-rally.itf.json';
import scoringAfterReopen from './fixtures/pong-scoring-after-repeated-reopen.itf.json';
import reopenAfterServe from './fixtures/pong-scoring-reopen-after-serve.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'pong-scoring',
  traces: 16,
  maxSteps: 12,
  regressions: [
    {
      // regression: pong-scoring-reopen-after-serve
      id: 'pong-scoring-reopen-after-serve',
      title:
        'Reopening immediately after the serve preserves the one-point match',
      seed: '0x67932',
      itf: reopenAfterServe,
    },
    {
      // regression: pong-scoring-after-long-rally
      id: 'pong-scoring-after-long-rally',
      title:
        'The scoring driver guides paddles toward the visible ball landing',
      seed: '0x67932',
      itf: scoringAfterLongRally,
    },
    {
      // regression: pong-scoring-after-repeated-reopen
      id: 'pong-scoring-after-repeated-reopen',
      title:
        'Either paddle can win after repeatedly reopening the ongoing game',
      seed: '0x67932',
      itf: scoringAfterReopen,
    },
  ],
  actions: {
    init: (w, picks) =>
      w.s.apply(establishLocalPong, true, Number(picks['target'])),
    countdownEnds: (w) => w.s.apply(finishPongCountdown),
    pointWon: (w, picks) =>
      w.s.apply(winPongPoint, picks['paddle'] as PongPaddle),
    waitAfterFinish: (w) => w.s.advanceTime(5000),
    reopenApp: (w) => w.s.apply(restartApp, 'alice'),
  },
  observe: async (w) => {
    const view = await w.quiet.read(pongScoreboard);
    return {
      score: new Map([
        ['left', view.score.left],
        ['right', view.score.right],
      ]),
      targetScore: view.targetScore,
      stage: view.stage,
      winner: view.winner ?? '',
      moveListOffered: await w.quiet.read(pongMoveListOffered),
    };
  },
});
