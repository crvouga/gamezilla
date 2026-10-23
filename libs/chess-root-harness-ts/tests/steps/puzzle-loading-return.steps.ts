import {
  controlLichessFileSave,
  finishSavingChosenLichessFile,
  leavePuzzleLoading,
} from '@libs/chess-root-harness-ts/lichess-file-actions';
import {
  prepareChosenLichessFile,
  prepareSavingLichessFile,
} from '@libs/chess-root-harness-ts/lichess-file-setup';
import { preparePuzzleImport } from '@libs/chess-root-harness-ts/puzzle-import-setup';
import {
  advancePuzzleImport,
  failPuzzleImport,
  finishPuzzleImport,
} from '@libs/chess-root-harness-ts/puzzle-import-world';
import { Given } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

Given(
  'adding puzzles finished while {actor} was away',
  async (w, actor: Actor) => {
    await w.s.apply(preparePuzzleImport);
    await w.s.apply(leavePuzzleLoading, actor);
    await w.s.apply(finishPuzzleImport);
  }
);
Given(
  'adding puzzles failed while {actor} was away',
  async (w, actor: Actor) => {
    await w.s.apply(preparePuzzleImport);
    await w.s.apply(advancePuzzleImport);
    await w.s.apply(leavePuzzleLoading, actor);
    await w.s.apply(failPuzzleImport);
  }
);
Given(
  '{actor} left before the first Lichess file finished saving',
  async (w, actor: Actor) => {
    await w.s.apply(prepareSavingLichessFile, actor);
    await w.s.apply(leavePuzzleLoading, actor);
    await w.s.apply(controlLichessFileSave, null, actor);
  }
);
Given(
  '{actor} has left after the Lichess file finished saving',
  async (w, actor: Actor) => {
    await w.s.apply(prepareChosenLichessFile, false, actor);
    await w.s.apply(finishSavingChosenLichessFile, actor);
    await w.s.apply(leavePuzzleLoading, actor);
  }
);
