import {
  partition,
  refreshActorConnection,
  refreshActorQueries,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  establishSharedPong,
  guideSharedPong,
  joinSharedPong,
} from '@libs/pong-harness-ts/pong-shared-actions';
import {
  type PongPlace,
  pongSharedCourts,
} from '@libs/pong-harness-ts/pong-shared-view';
import type { PongPaddle } from '@libs/pong-harness-ts/pong-view';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import matchedControlsTrace from './fixtures/pong-matched-paddle-controls.itf.json';
import offlinePresentationTrace from './fixtures/pong-offline-presentation-rollback.itf.json';
import spectatorReturnTrace from './fixtures/pong-spectator-return-during-pause.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'pong-shared-control',
  traces: 16,
  maxSteps: 8,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: pong-matched-paddle-controls
      id: 'pong-matched-paddle-controls',
      title: 'Matched players can guide their own paddle on the shared court',
      seed: '0x67932',
      itf: matchedControlsTrace,
    },
    {
      // regression: pong-offline-presentation-rollback
      id: 'pong-offline-presentation-rollback',
      title: 'A disconnected person keeps the last court they saw',
      seed: '0x67932',
      itf: offlinePresentationTrace,
    },
    {
      // regression: pong-spectator-return-during-pause
      id: 'pong-spectator-return-during-pause',
      title:
        'A returning viewer receives the current court while play is paused',
      seed: '0x67932',
      itf: spectatorReturnTrace,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(establishSharedPong);
      await w.s.apply(joinSharedPong, 'carol', 'alice');
    },
    guidePaddle: (w, picks) =>
      w.s.apply(
        guideSharedPong,
        String(picks['person']),
        picks['paddle'] as PongPaddle,
        picks['place'] as PongPlace
      ),
    loseConnection: async (w, picks) => {
      const person = String(picks['person']);
      await w.s.apply(partition, person);
      await w.s.apply(refreshActorConnection, person);
      await w.s.apply(refreshActorQueries, person);
    },
    connectionReturns: async (w, picks) => {
      const person = String(picks['person']);
      await w.s.apply(restoreActorConnection, person);
      await w.s.apply(refreshActorQueries, person);
    },
  },
  observe: (w) => w.quiet.read(pongSharedCourts),
});
