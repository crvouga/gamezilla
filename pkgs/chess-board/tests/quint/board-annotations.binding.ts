import type { Square } from '@pkgs/chess-board/chess-board-types';
import {
  type ArrowAppearance,
  type BoardWorld,
  beginArrowObservation,
  beginPersonalArrow,
  cancelPersonalArrow,
  chooseActivityArrow,
  clearActivityAnnotations,
  configureBoard,
  type FeedbackAppearance,
  finishPersonalArrow,
  INITIAL,
  REPLACEMENT,
  readAnnotationModel,
  readModelFingerprint,
  readProbe,
  selectSquare,
  setupBoard,
  supplyActivityArrows,
  supplyActivitySquares,
  supplyFeedbackMarks,
  togglePersonalCircle,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { bindQuintModel, type QuintBinding } from '@pkgs/quint/registry';

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
