import { auditTree } from '@pkgs/a11y';
import type { Square } from '@pkgs/chess-board-core/types';
import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
  type Session,
  virtualTimeRuntime,
} from '@pkgs/harness';
import { createExampleApp, type ExampleConfig } from './example-app';
import { CAPTURE, CAPTURED, REPLACEMENT } from './positions';

export { CAPTURE, CAPTURED, INITIAL, REPLACEMENT } from './positions';
export type BoardWorld = {
  audited: boolean;
  readonly session: Session;
  readonly app: ReturnType<typeof createExampleApp>;
};
export const setupBoard = defineAction({
  name: 'setupBoard',
  act: (w: BoardWorld, config: ExampleConfig) => w.app.reset(config),
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
export const readBoard = (w: BoardWorld) => w.app.view();
export const readProbe = (w: BoardWorld) => w.app.probe();
export const readSquare = (w: BoardWorld, square: Square) =>
  w.app.square(square);
export const boardSystem = defineSystem<BoardWorld>({
  name: 'chess-board',
  create(session) {
    return { session, app: createExampleApp(session), audited:false };
  },
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  properties: [
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
        if (!w.audited) {
          if (auditTree(w.app.host).length > 0) throw new Error('Chessboard accessibility audit failed');
          w.audited = true;
        }
      },
    }),
  ],
  actions: [
    setupBoard,
    configureBoard,
    selectSquare,
    movePiece,
    beginDrag,
    cancelDrag,
    reduceMotion,
    closeBoard,
  ],
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
export const readSlides = (w: BoardWorld) => w.app.motion.slides();
export const finishAnimation = defineAction({
  name: 'finishAnimation',
  act: (w: BoardWorld) => w.session.advanceTime(1000),
});
export const readLifecycle = (w: BoardWorld) => {
  const probe = w.app.probe();
  const fen = probe.fen.split(' ').slice(0, 2).join(' ');
  const boards = [CAPTURE, CAPTURED, REPLACEMENT].map((p) =>
    p.split(' ').slice(0, 2).join(' ')
  );
  return {
    board: {
      position: boards.indexOf(fen),
      selected: probe.selected !== null,
      dragging: w.app.view().holding,
      interactive: probe.interactive,
      soundEnabled: w.app.config().sound !== false,
      reducedMotion: w.app.motion.env.prefersReducedMotion(),
      orientation: probe.orientation,
      transition: w.app.motion.active() > 0,
    },
  };
};
