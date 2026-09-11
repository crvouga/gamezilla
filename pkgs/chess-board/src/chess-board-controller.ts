/**
 * Pointer / keyboard / theme wiring for {@link ChessBoard}.
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

import {
  type BoardColorScheme,
  defaultBoardTheme,
  mergeBoardTheme,
} from './board-theme';
import {
  type BoardHandlers,
  createBoardHandlers,
} from './chess-board-handlers';
import { createChessBoardSounds } from './chess-board-sounds';
import { createUserShapes } from './chess-board-user-shapes';
import {
  type ChessBoardModel,
  createChessBoardModel,
} from './create-chess-board-model';
import {
  createDragGhostController,
  type DragGhostController,
} from './drag-ghost-controller';
import { defaultCursorSquare } from './keyboard-nav';
import { createPointerSession, type PointerSession } from './pointer-session';
import type { SmartChessBoardProps } from './smart-chess-board-types';
import { wallCancelFrame, wallScheduleFrame } from './wall-frames';

/** Piece slide / capture ghost / delayed capture SFX. Keep CSS `--chess-move-ms` in sync. */
export const MOVE_DURATION_MS = 150;

export type BoardController = BoardHandlers & {
  readonly model: ChessBoardModel;
  readonly session: PointerSession;
  readonly ghost: DragGhostController;
  readonly host: Accessor<HTMLElement | undefined>;
  readonly setHost: (el: HTMLElement) => void;
  readonly boardPx: Accessor<number>;
  readonly cursor: Accessor<Square>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly animated: Accessor<boolean>;
  readonly theme: Accessor<ReturnType<typeof mergeBoardTheme>>;
  readonly arrows: Accessor<
    ReturnType<ReturnType<typeof createUserShapes>['arrows']>
  >;
  readonly shapes: Accessor<
    ReturnType<ReturnType<typeof createUserShapes>['shapes']>
  >;
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

function createBoardModel(
  props: SmartChessBoardProps,
  orientation: Accessor<BoardOrientation>,
  animated: Accessor<boolean>,
  timers: Timers
): ChessBoardModel {
  return createChessBoardModel({
    game: untrack(() => new ChessGame(props.fen)),
    fen: () => props.fen,
    fenSyncKey: () => props.fenSyncKey,
    interactive: () => props.interactive !== false,
    animated,
    moveDurationMs: MOVE_DURATION_MS,
    onMove: (m) => props.onMove?.(m),
    sounds: createChessBoardSounds(),
    timers,
    premoves: () => props.premoves === true,
    autoPromoteQueen: () => props.autoPromoteQueen === true,
    playerColor: () =>
      props.premoves === true ? (orientation() === 'white' ? 'w' : 'b') : null,
  });
}

export function createBoardController(args: {
  readonly props: SmartChessBoardProps;
  readonly colorScheme: Accessor<BoardColorScheme>;
  readonly timers: Timers;
}): BoardController {
  const props = args.props;
  const [host, setHost] = createSignal<HTMLElement | undefined>();
  const boardPx = useBoardPx(host, () => props.size);
  const [cursor, setCursor] = createSignal(
    defaultCursorSquare(props.orientation ?? 'white')
  );
  const [reduced, setReduced] = createSignal(false);
  createEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    onCleanup(() => mq.removeEventListener('change', onChange));
  });
  const orientation = () => props.orientation ?? 'white';
  const animated = () => props.animations !== false && !reduced();
  const theme = createMemo(() =>
    mergeBoardTheme(defaultBoardTheme(args.colorScheme()), props.theme)
  );
  const model = createBoardModel(props, orientation, animated, args.timers);
  const session = createPointerSession(model.actions);
  const ghost = createDragGhostController(wallScheduleFrame, wallCancelFrame);
  const userArrows = createUserShapes({
    onChange: (shapes) => {
      const arrowsOnly = shapes.flatMap((s) => {
        if (s.kind !== 'arrow') return [];
        return [
          {
            from: s.from,
            to: s.to,
            color: s.color,
            ...(s.id !== undefined ? { id: s.id } : {}),
          },
        ];
      });
      props.onUserArrowsChange?.(arrowsOnly);
    },
  });
  const arrows = createMemo(() => [
    ...(props.arrows ?? []),
    ...userArrows.arrows(),
  ]);
  return {
    model,
    session,
    ghost,
    host,
    setHost,
    boardPx,
    cursor,
    orientation,
    animated,
    theme,
    arrows,
    shapes: userArrows.shapes,
    ...createBoardHandlers({
      host,
      boardPx,
      orientation,
      enableUserArrows: () => props.enableUserArrows === true,
      session,
      model,
      userArrows,
      cursor,
      setCursor,
      ghost,
    }),
  };
}
