import {
  moveSokobanWorker,
  redoSokobanMove,
  restartSokobanPuzzle,
  undoSokobanMove,
} from '@libs/sokoban-harness-ts/sokoban-play';
import {
  setupSokobanPlay,
  sokobanPlayState,
} from '@libs/sokoban-harness-ts/sokoban-play-model';
import type { SokobanHarness } from '@libs/sokoban-harness-ts/sokoban-system';
import type { SokobanDirection } from '@libs/sokoban-shared-ts/sokoban-types';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const BOB = 'bob:phone';

bindQuintModel<Run<SokobanHarness>>({
  model: 'sokoban-play',
  traces: 12,
  maxSteps: 10,
  actions: {
    init: (run, picks) => {
      const start = picks['start'] as { crates: ReadonlySet<bigint | number> };
      const second = [...start.crates].map(Number).includes(4);
      return run.apply(setupSokobanPlay, second ? 'second' : 'first');
    },
    moveWorker: (run, picks) =>
      run.apply(
        moveSokobanWorker,
        BOB,
        String(picks['direction']) as SokobanDirection
      ),
    undoMove: (run) => run.apply(undoSokobanMove, BOB),
    redoMove: (run) => run.apply(redoSokobanMove, BOB),
    restartPuzzle: (run) => run.apply(restartSokobanPuzzle, BOB),
  },
  observe: (run) => run.read(sokobanPlayState),
});
