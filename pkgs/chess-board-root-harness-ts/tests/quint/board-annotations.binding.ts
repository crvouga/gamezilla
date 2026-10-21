import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import {
  beginPersonalArrow,
  cancelPersonalArrow,
  clearActivityAnnotations,
  finishPersonalArrow,
  supplyActivityArrows,
  supplyActivitySquares,
  togglePersonalCircle,
} from '@pkgs/chess-board-root-harness-ts/annotation-actions';
import type {
  ArrowAppearance,
  FeedbackAppearance,
} from '@pkgs/chess-board-root-harness-ts/annotation-appearance';
import {
  chooseActivityArrow,
  supplyFeedbackMarks,
} from '@pkgs/chess-board-root-harness-ts/annotation-appearance';
import {
  beginArrowObservation,
  readAnnotationModel,
} from '@pkgs/chess-board-root-harness-ts/annotation-model';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import {
  configureBoard,
  readProbe,
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import { readModelFingerprint } from '@pkgs/chess-board-root-harness-ts/model-evidence';
import {
  INITIAL,
  REPLACEMENT,
} from '@pkgs/chess-board-root-harness-ts/positions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import type { QuintBinding } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

function observeArrowInputs(actions: QuintBinding<Run<BoardWorld>>['actions']) {
  return Object.fromEntries(
    Object.entries(actions).map(([name, input]) => [
      name,
      async (w: Run<BoardWorld>, picks: Parameters<typeof input>[1]) => {
        await w.apply(beginArrowObservation);
        await input(w, picks);
      },
    ])
  );
}
bindQuintModel<Run<BoardWorld>>({
  model: 'board-annotations',
  traces: 100,
  maxSteps: 30,
  verifySteps: 4,
  actions: observeArrowInputs({
    init: (w) =>
      w.apply(setupBoard, { enableUserArrows: true, animations: false }),
    beginPersonalArrow: (w, p) => {
      const [from, to] = (p['arrow'] as string).split(' to ') as [
        Square,
        Square,
      ];
      return w.apply(beginPersonalArrow, from, to);
    },
    finishPersonalArrow: (w) => w.apply(finishPersonalArrow),
    cancelPersonalArrow: (w) => w.apply(cancelPersonalArrow),
    togglePersonalCircle: (w, p) =>
      w.apply(togglePersonalCircle, p['square'] as Square),
    clearPersonalAnnotations: (w) => w.apply(selectSquare, 'e2'),
    setActivityArrows: (w, p) => w.apply(supplyActivityArrows, p['show']),
    setActivitySquareMarks: (w, p) => w.apply(supplyActivitySquares, p['show']),
    chooseActivityArrow: (w, p) =>
      w.apply(chooseActivityArrow, p['arrowAppearance'] as ArrowAppearance),
    supplyFeedbackMarks: (w, p) =>
      w.apply(
        supplyFeedbackMarks,
        p['feedbackAppearance'] as FeedbackAppearance
      ),
    clearActivityAnnotations: (w) => w.apply(clearActivityAnnotations),
    configurePersonalAnnotations: (w, p) =>
      w.apply(configureBoard, {
        enableUserArrows: p['canAnnotate'] as boolean,
      }),
    flipAnnotationBoard: async (w) => {
      const current = await w.read(readProbe);
      await w.apply(configureBoard, {
        orientation: current.orientation === 'white' ? 'black' : 'white',
      });
    },
    replaceAnnotationPosition: (w, p) =>
      w.apply(configureBoard, {
        fen: p['target'] === 'opening' ? INITIAL : REPLACEMENT,
      }),
  }),
  observe: (w) => w.read(readAnnotationModel),
  fingerprint: (w) => w.read(readModelFingerprint),
});
