import {
  redoDraftEditInBuilder,
  undoDraftEditInBuilder,
} from '@libs/game-puzzle-harness-ts/builder-session';
import { reopenContentDevice } from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  editSokobanSquare,
  resizeSokobanBoard,
  type SokobanTool,
} from '@libs/sokoban-harness-ts/sokoban-building';
import {
  boardBuildingState,
  type ModelSquare,
  modelSquareName,
  setupBoardBuilding,
} from '@libs/sokoban-harness-ts/sokoban-building-model';
import type { SokobanHarness } from '@libs/sokoban-harness-ts/sokoban-system';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

const ALICE = 'alice:phone';
const square = (picks: Readonly<Record<string, unknown>>): string => {
  const at = picks['square'] as {
    column: bigint | number;
    row: bigint | number;
  };
  const named: ModelSquare = { column: Number(at.column), row: Number(at.row) };
  return modelSquareName(named);
};
const edit = (run: Run<SokobanHarness>, tool: SokobanTool, name: string) =>
  run.apply(editSokobanSquare, tool, name);

bindQuintModel<Run<SokobanHarness>>({
  model: 'board-building',
  traces: 12,
  maxSteps: 10,
  actions: {
    init: (run, picks) => {
      const start = picks['start'] as { worker: ReadonlySet<unknown> };
      return run.apply(setupBoardBuilding, start.worker.size > 0);
    },
    changeBoardSize: (run, picks) =>
      run.apply(
        resizeSokobanBoard,
        Number(picks['columns']),
        Number(picks['rows'])
      ),
    paintSquare: (run, picks) =>
      edit(run, String(picks['kind']) as SokobanTool, square(picks)),
    placeWorker: (run, picks) => edit(run, 'worker', square(picks)),
    placeCrate: (run, picks) => edit(run, 'crate', square(picks)),
    removeCrate: (run, picks) => edit(run, 'remove-crate', square(picks)),
    eraseSquare: (run, picks) => edit(run, 'erase', square(picks)),
    undoBoardEdit: (run) => run.apply(undoDraftEditInBuilder, ALICE),
    redoBoardEdit: (run) => run.apply(redoDraftEditInBuilder, ALICE),
    reopenApp: (run) => run.apply(reopenContentDevice, ALICE),
  },
  observe: (run) => run.read(boardBuildingState),
});
