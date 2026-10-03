import { auditTree } from '@pkgs/a11y';
import type { Square } from '@pkgs/chess-board-core/types';
import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/harness';
import { annotationActions } from './annotation-actions';
import { appearanceActions } from './annotation-appearance';
import { beginArrowObservation } from './annotation-model';
import { annotationSetupActions } from './annotation-setup';
import { authorityActions } from './authority-actions';
import { prepareBlackPromotion } from './black-promotion-setup';
import type { BoardWorld } from './board-world';
import { createExampleApp, type ExampleConfig } from './example-app';
import { interactionActions } from './interaction-actions';
import { keyboardActions } from './keyboard-actions';
import { lifecycleActions } from './lifecycle-actions';
import { prepareRapidCapture } from './motion-setup';
import { openingActions } from './opening-actions';
import { optionsActions } from './options-actions';
import { pairActions } from './pair-actions';
import { pairConformance } from './pair-conformance';
import { premoveActions } from './premove-actions';
import { prepareTwoPremoves } from './premove-setup';
import { prepareFixedWidthPromotion } from './width-promotion-setup';

export * from './annotation-actions';
export * from './annotation-appearance';
export * from './annotation-model';
export * from './annotation-reads';
export * from './annotation-setup';
export * from './authority-actions';
export * from './black-promotion-setup';
export type { BoardWorld } from './board-world';
export * from './feedback-dom';
export * from './interaction-actions';
export * from './interaction-fixtures';
export * from './interaction-reads';
export * from './keyboard-actions';
export * from './keyboard-model';
export * from './lifecycle-actions';
export * from './model-evidence';
export * from './motion-setup';
export * from './opening-actions';
export * from './options-actions';
export * from './options-model';
export * from './options-reads';
export * from './pair-actions';
export * from './pair-reads';
export type { PairSide } from './pair-world';
export { CAPTURE, CAPTURED, INITIAL, REPLACEMENT } from './positions';
export * from './premove-actions';
export * from './premove-model';
export * from './premove-setup';
export * from './prepared-positions';
export * from './promotion-access';
export * from './promotion-model';
export * from './width-promotion-setup';
export const setupBoard = defineAction({
  name: 'setupBoard',
  act: (w: BoardWorld, config: ExampleConfig) => {
    w.app.close();
    const earlierCompletion = w.app.motion.earlierCompletion;
    w.app = createExampleApp(w.session, config, earlierCompletion);
    w.auditedMarkups.clear();
  },
});
export const configureBoard = defineAction({
  name: 'configureBoard',
  act: (w: BoardWorld, config: Partial<ExampleConfig>) =>
    w.app.configure(config),
});
export const selectSquare = defineAction({
  name: 'selectSquare',
  act: (w: BoardWorld, square: Square) => w.app.tap(square),
});
export const movePiece = defineAction({
  name: 'movePiece',
  act: (w: BoardWorld, from: Square, to: Square, keyboard = false) => {
    if (w.app.view().holding) {
      w.app.pointer('pointermove', to);
      w.app.pointer('pointerup', to);
      return;
    }
    if (w.app.probe().selected === from) {
      w.app.tap(to);
      return;
    }
    if (keyboard) {
      w.app.key(from);
      w.app.key(to);
    } else {
      w.app.tap(from);
      w.app.tap(to);
    }
  },
});
export const beginDrag = defineAction({
  name: 'beginDrag',
  act: (w: BoardWorld, from: Square) => w.app.pointer('pointerdown', from),
});
export const cancelDrag = defineAction({
  name: 'cancelDrag',
  act: (w: BoardWorld) => w.app.pointer('pointercancel', 'e4'),
});
export const reduceMotion = defineAction({
  name: 'reduceMotion',
  act: (w: BoardWorld, reduced: boolean) =>
    w.app.motion.setReducedMotion(reduced),
});
export const closeBoard = defineAction({
  name: 'closeBoard',
  act: (w: BoardWorld) => w.app.close(),
});
export const setVisibility = defineAction({
  name: 'setVisibility',
  act: (w: BoardWorld, visible: boolean) => w.app.motion.setHidden(!visible),
});
export const leaveActivity = defineAction({
  name: 'leaveActivity',
  act: (_w: BoardWorld) => {
    window.dispatchEvent(new Event('blur'));
  },
});
export const replacePosition = defineAction({
  name: 'replacePosition',
  act: (w: BoardWorld, fen: string) =>
    w.app.configure({ fen, fenSyncKey: (w.app.config().fenSyncKey ?? 0) + 1 }),
});
export const resizeBoard = defineAction({
  name: 'resizeBoard',
  act: (w: BoardWorld) =>
    w.app.configure({ size: w.app.config().size === 512 ? 320 : 512 }),
});
export const finishAnimation = defineAction({
  name: 'finishAnimation',
  act: (w: BoardWorld) => w.session.advanceTime(1000),
});
export const readBoard = (w: BoardWorld) => w.app.view();
export const readProbe = (w: BoardWorld) => w.app.probe();
export const readSquare = (w: BoardWorld, square: Square) =>
  w.app.square(square);
export const boardSystem = defineSystem<BoardWorld>({
  name: 'chess-board',
  create(session) {
    return {
      session,
      app: createExampleApp(session),
      auditedMarkups: new Set(),
    };
  },
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  properties: [
    pairConformance,
    defineProperty({
      name: 'board-render-conformance',
      check(w) {
        if (w.app.closed()) return;
        const probe = w.app.probe();
        const visible = w.app.view();
        const expected = probe.pieces
          .map((p) => `${p.piece}@${p.square}`)
          .sort();
        if (JSON.stringify(visible.pieces) !== JSON.stringify(expected))
          throw new Error('Painted pieces diverged from the latest position');
        if (
          new Set(visible.pieces.map((p) => p.split('@')[1])).size !==
          visible.pieces.length
        )
          throw new Error('Duplicate visual square');
        const markup = w.app.host.outerHTML;
        if (!w.auditedMarkups.has(markup)) {
          const findings = auditTree(w.app.host);
          if (findings.length > 0)
            throw new Error(
              'Chessboard accessibility audit failed: ' +
                JSON.stringify(findings)
            );
          w.auditedMarkups.add(markup);
        }
      },
    }),
  ],
  actions: [
    ...interactionActions,
    ...keyboardActions,
    ...lifecycleActions,
    ...authorityActions,
    ...annotationActions,
    ...appearanceActions,
    ...annotationSetupActions,
    ...optionsActions,
    ...openingActions,
    ...pairActions,
    ...premoveActions,
    beginArrowObservation,
    prepareBlackPromotion,
    prepareFixedWidthPromotion,
    prepareRapidCapture,
    prepareTwoPremoves,
    setupBoard,
    configureBoard,
    selectSquare,
    movePiece,
    beginDrag,
    cancelDrag,
    reduceMotion,
    closeBoard,
    setVisibility,
    leaveActivity,
    replacePosition,
    resizeBoard,
    finishAnimation,
  ],
});
export const readSlides = (w: BoardWorld) => w.app.motion.slides();
export { lifecyclePosition, readLifecycle } from './lifecycle-reads';
