import { observeElementResize } from '@pkgs/ui-root-client-ts/observe-element-resize';
/**
 * Wiring for {@link ChessBoard}: the rules model, the motion policy, piece
 * placement / drag, and the pointer + keyboard input. Solid owns only what
 * changes per move; the per-frame paths (drag, hover) are imperative.
 */

import { ChessGame } from '@pkgs/chess-board-core-shared-ts/game';
import type {
  BoardOrientation,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import { createBoardHaptics } from '@pkgs/chess-board-root-client-ts/chess-board-haptics';
import type { MotionPolicy } from '@pkgs/chess-board-root-shared-ts/board-motion';
import { resolveMotionPolicy } from '@pkgs/chess-board-root-shared-ts/board-motion';
import type { BoardColorScheme } from '@pkgs/chess-board-root-shared-ts/board-theme';
import {
  defaultBoardTheme,
  mergeBoardTheme,
} from '@pkgs/chess-board-root-shared-ts/board-theme';
import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { defaultCursorSquare } from '@pkgs/chess-board-root-shared-ts/keyboard-nav';
import type { PieceAnimator } from '@pkgs/chess-board-root-shared-ts/piece-animator';
import { createPieceAnimator } from '@pkgs/chess-board-root-shared-ts/piece-animator';
import {
  createHoverSquare,
  createPieceDrag,
} from '@pkgs/chess-board-root-shared-ts/piece-drag';
import type { PointerSession } from '@pkgs/chess-board-root-shared-ts/pointer-session';
import { createPointerSession } from '@pkgs/chess-board-root-shared-ts/pointer-session';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import { watchBoardInput } from './board-input-lifecycle';
import { useBoardMotionEnvironment } from './board-motion-context';
import styles from './chess-board/chess-board.module.css';
import { createBoardKeyHandler } from './chess-board-keys';
import { BoardPointer } from './chess-board-pointer';
import { createChessBoardSounds } from './chess-board-sounds';
import type { UserShapes } from './chess-board-user-shapes';
import { createUserShapes } from './chess-board-user-shapes';
import type { ChessBoardModel } from './create-chess-board-model';
import { createChessBoardModel } from './create-chess-board-model';

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
  /** Return keyboard ownership from the promotion picker to a square. */
  readonly focusSquare: (square: Square) => void;
};

/** Matches `@pkgs/ui-testing-solid-dom` `ELEMENT_LAYOUT_EVENT` (no dep edge). */
const ELEMENT_LAYOUT_EVENT = 'ui-testing:element-layout';

/** Preserve the parent dimension; percentages tile fractional cells exactly. */
export function normalizeBoardSize(width: number): number {
  return Number.isFinite(width) && width > 0 ? width : 0;
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
    const fixed = sizeProp();
    if (fixed !== undefined) {
      setMeasured(normalizeBoardSize(fixed));
      return;
    }
    const node = el();
    if (node === undefined) return;
    const apply = (width: number): void => {
      setMeasured(normalizeBoardSize(width));
    };
    apply(node.offsetWidth || node.getBoundingClientRect().width);
    const onLayout = (): void => {
      apply(node.offsetWidth || node.getBoundingClientRect().width);
    };
    const stopResize = observeElementResize(node, (entry) => {
      apply(
        entry?.borderBoxSize[0]?.inlineSize ??
          (entry?.contentRect.width ?? 0) + 2 * node.clientLeft
      );
    });
    node.addEventListener(ELEMENT_LAYOUT_EVENT, onLayout);
    onCleanup(() => {
      stopResize();
      node.removeEventListener(ELEMENT_LAYOUT_EVENT, onLayout);
    });
  });
  return () => {
    const fixed = sizeProp();
    if (fixed !== undefined) return normalizeBoardSize(fixed);
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
      canAnimate: env.animate !== null && !env.hidden(),
    })
  );
  const animator = createPieceAnimator({
    animate: () => (env.hidden() ? null : env.animate),
    paintedTransform: env.paintedTransform,
  });
  createEffect(() => {
    if (!motion().slides) animator.dispose();
  });
  onCleanup(animator.dispose);
  return { motion, animator, hidden: env.hidden };
}

function createModel(args: {
  props: ChessBoardProps;
  motion: Accessor<MotionPolicy>;
  timers: Timers;
  boardPx: Accessor<number>;
  onIllegal: () => void;
}): ChessBoardModel {
  const { props, motion, timers, onIllegal } = args;
  return createChessBoardModel({
    game: untrack(() => new ChessGame(props.fen)),
    fen: () => props.fen,
    fenSyncKey: () => props.fenSyncKey,
    interactive: () =>
      props.interactive !== false &&
      args.boardPx() >= 196 &&
      args.boardPx() <= 16384,
    animated: () => motion().slides,
    moveDurationMs: () => motion().durationMs,
    onMove: (m) => props.onMove?.(m),
    onIllegal,
    sounds: createChessBoardSounds(() => props.sound !== false),
    soundEnabled: () => props.sound !== false,
    orientation: () => props.orientation ?? 'white',
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
    readonly hidden: Accessor<boolean>;
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
  watchBoardInput(props, parts, pointer);
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
    clearAnnotations: parts.userShapes.clear,
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
  const { motion, animator, hidden } = createMotion(props);
  const haptics = createBoardHaptics(() => true);
  let touch = false;
  const model = createModel({
    props,
    motion,
    timers: args.timers,
    boardPx,
    onIllegal: () => {
      if (touch) haptics.illegal();
    },
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
      hidden,
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
    focusSquare: (square) => {
      input.setCursor(square);
      host()?.querySelector<HTMLElement>(`[data-square="${square}"]`)?.focus();
    },
  };
}
