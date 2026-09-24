/**
 * Wiring for {@link ChessBoard}: the rules model, the motion policy, piece
 * placement / drag, and the pointer + keyboard input. Solid owns only what
 * changes per move; the per-frame paths (drag, hover) are imperative.
 */

import { ChessGame } from '@pkgs/chess-board-core/game';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core/types';
import type { Timers } from '@pkgs/clock/types';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import { type MotionPolicy, resolveMotionPolicy } from './board-motion';
import { useBoardMotionEnvironment } from './board-motion-context';
import {
  type BoardColorScheme,
  defaultBoardTheme,
  mergeBoardTheme,
} from './board-theme';
import styles from './chess-board.module.css';
import { createBoardHaptics } from './chess-board-haptics';
import { createBoardKeyHandler } from './chess-board-keys';
import { BoardPointer } from './chess-board-pointer';
import { createChessBoardSounds } from './chess-board-sounds';
import type { ChessBoardProps } from './chess-board-types';
import { createUserShapes, type UserShapes } from './chess-board-user-shapes';
import {
  type ChessBoardModel,
  createChessBoardModel,
} from './create-chess-board-model';
import { defaultCursorSquare } from './keyboard-nav';
import { createPieceAnimator, type PieceAnimator } from './piece-animator';
import { createHoverSquare, createPieceDrag } from './piece-drag';
import { createPointerSession, type PointerSession } from './pointer-session';

export type BoardController = {
  readonly model: ChessBoardModel;
  readonly session: PointerSession;
  readonly animator: PieceAnimator;
  readonly setHost: (el: HTMLElement) => void;
  readonly setHover: (el: HTMLElement) => void;
  readonly boardPx: Accessor<number>;
  readonly cursor: Accessor<Square>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly motion: Accessor<MotionPolicy>;
  readonly theme: Accessor<ReturnType<typeof mergeBoardTheme>>;
  readonly userShapes: UserShapes;
  readonly arrows: Accessor<ReturnType<UserShapes['arrows']>>;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  /** A hit-grid square button took focus: the cursor follows it. */
  readonly onSquareFocus: (square: Square) => void;
};

/** Matches `@pkgs/ui-testing-solid-dom` `ELEMENT_LAYOUT_EVENT` (no dep edge). */
const ELEMENT_LAYOUT_EVENT = 'ui-testing:element-layout';

/** Snap CSS px so the board spans a multiple of 8 device pixels. */
export function snapBoardPx(width: number): number {
  if (!(width > 0)) return 0;
  const dpr = window.devicePixelRatio || 1;
  return (Math.floor((width * dpr) / 8) * 8) / dpr;
}

/**
 * Host width in px. When the parent passes a fixed `size` prop, trust that
 * (no ResizeObserver). Fill-width mode observes the host.
 */
function useBoardPx(
  el: Accessor<HTMLElement | undefined>,
  sizeProp: Accessor<number | undefined>
): Accessor<number> {
  const [measured, setMeasured] = createSignal(0);
  createEffect(() => {
    if (sizeProp() !== undefined) return;
    const node = el();
    if (node === undefined) return;
    const apply = (width: number): void => {
      const snapped = snapBoardPx(width);
      if (snapped > 0) setMeasured(snapped);
    };
    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(node);
    apply(node.getBoundingClientRect().width);
    const onLayout = (): void => {
      apply(node.getBoundingClientRect().width);
    };
    node.addEventListener(ELEMENT_LAYOUT_EVENT, onLayout);
    onCleanup(() => {
      ro.disconnect();
      node.removeEventListener(ELEMENT_LAYOUT_EVENT, onLayout);
    });
  });
  return () => {
    const fixed = sizeProp();
    if (fixed !== undefined) return snapBoardPx(fixed);
    return measured();
  };
}

function createUserShapesFor(props: ChessBoardProps): UserShapes {
  return createUserShapes({
    onChange: (shapes) => {
      props.onUserArrowsChange?.(
        shapes.flatMap((s) =>
          s.kind === 'arrow'
            ? [
                {
                  from: s.from,
                  to: s.to,
                  color: s.color,
                  ...(s.id !== undefined ? { id: s.id } : {}),
                },
              ]
            : []
        )
      );
    },
  });
}

function createMotion(props: ChessBoardProps) {
  const env = useBoardMotionEnvironment();
  const motion = createMemo(() =>
    resolveMotionPolicy({
      enabled: props.animations !== false,
      durationMs: props.animationDurationMs,
      prefersReducedMotion: env.prefersReducedMotion(),
      lowEnd: env.lowEnd,
      canAnimate: env.animate !== null,
    })
  );
  const animator = createPieceAnimator({
    animate: () => (env.hidden() ? null : env.animate),
    paintedTransform: env.paintedTransform,
  });
  onCleanup(animator.dispose);
  return { motion, animator };
}

function createModel(
  props: ChessBoardProps,
  motion: Accessor<MotionPolicy>,
  timers: Timers,
  onIllegal: () => void
): ChessBoardModel {
  return createChessBoardModel({
    game: untrack(() => new ChessGame(props.fen)),
    fen: () => props.fen,
    fenSyncKey: () => props.fenSyncKey,
    interactive: () => props.interactive !== false,
    animated: () => motion().slides,
    moveDurationMs: () => motion().durationMs,
    onMove: (m) => props.onMove?.(m),
    onIllegal,
    sounds: createChessBoardSounds(),
    timers,
    premoves: () => props.premoves === true,
    autoPromoteQueen: () => props.autoPromoteQueen === true,
    playerColor: () =>
      props.premoves === true
        ? (props.orientation ?? 'white') === 'white'
          ? 'w'
          : 'b'
        : null,
  });
}

type Input = {
  readonly setHover: (el: HTMLElement) => void;
  readonly cursor: Accessor<Square>;
  readonly setCursor: (square: Square) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
};

/** Pointer (native listeners on the host) + keyboard. */
function createInput(args: {
  readonly props: ChessBoardProps;
  readonly host: Accessor<HTMLElement | undefined>;
  readonly parts: Pick<
    BoardController,
    'model' | 'session' | 'animator' | 'boardPx' | 'orientation' | 'motion'
  > & {
    readonly userShapes: UserShapes;
    readonly setTouch: (t: boolean) => void;
  };
  readonly haptics: ReturnType<typeof createBoardHaptics>;
}): Input {
  const { props, parts } = args;
  const [hoverEl, setHover] = createSignal<HTMLElement | undefined>();
  const [cursor, setCursor] = createSignal(
    defaultCursorSquare(untrack(parts.orientation))
  );
  const drag = createPieceDrag({
    piece: styles['piece'] ?? '',
    avatar: styles['avatar'] ?? '',
    avatarTouch: styles['avatarTouch'] ?? '',
    lifted: styles['lifted'] ?? '',
  });
  onCleanup(drag.dispose);
  const pointer = new BoardPointer({
    boardPx: parts.boardPx,
    orientation: parts.orientation,
    enableUserArrows: () => props.enableUserArrows === true,
    session: parts.session,
    actions: parts.model.actions,
    userShapes: parts.userShapes,
    setCursor,
    drag,
    hover: createHoverSquare(hoverEl, styles['hoverTouch'] ?? ''),
    animator: parts.animator,
    motion: parts.motion,
    haptics: args.haptics,
    dragActiveClass: styles['dragActive'] ?? '',
    setTouch: parts.setTouch,
  });
  createEffect(() => {
    const node = args.host();
    if (node === undefined) return;
    onCleanup(pointer.attach(node));
  });
  const onKeyDown = createBoardKeyHandler({
    host: args.host,
    orientation: parts.orientation,
    session: parts.session,
    cursor,
    setCursor,
    cancel: () => {
      pointer.cancelPress();
      parts.userShapes.abort();
      parts.model.actions.cancelAll();
    },
  });
  return { setHover, cursor, setCursor, onKeyDown };
}

export function createBoardController(args: {
  readonly props: ChessBoardProps;
  readonly colorScheme: Accessor<BoardColorScheme>;
  readonly timers: Timers;
}): BoardController {
  const props = args.props;
  const [host, setHost] = createSignal<HTMLElement | undefined>();
  const boardPx = useBoardPx(host, () => props.size);
  const orientation = () => props.orientation ?? 'white';
  const { motion, animator } = createMotion(props);
  const haptics = createBoardHaptics(() => true);
  let touch = false;
  const model = createModel(props, motion, args.timers, () => {
    if (touch) haptics.illegal();
  });
  const session = createPointerSession(model.actions);
  const userShapes = createUserShapesFor(props);
  const input = createInput({
    props,
    host,
    haptics,
    parts: {
      model,
      session,
      animator,
      boardPx,
      orientation,
      motion,
      userShapes,
      setTouch: (next) => {
        touch = next;
      },
    },
  });
  const theme = createMemo(() =>
    mergeBoardTheme(defaultBoardTheme(args.colorScheme()), props.theme)
  );
  const arrows = createMemo(() => [
    ...(props.arrows ?? []),
    ...userShapes.arrows(),
  ]);
  return {
    model,
    session,
    animator,
    setHost,
    setHover: input.setHover,
    boardPx,
    cursor: input.cursor,
    orientation,
    motion,
    theme,
    userShapes,
    arrows,
    onKeyDown: input.onKeyDown,
    onSquareFocus: input.setCursor,
  };
}
