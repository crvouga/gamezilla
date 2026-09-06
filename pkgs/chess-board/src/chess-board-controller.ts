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
import type { ChessBoardProps } from './chess-board-types';
import { createUserArrows } from './chess-board-user-arrows';
import {
  type ChessBoardModel,
  createChessBoardModel,
} from './create-chess-board-model';
import { defaultCursorSquare } from './keyboard-nav';
import { createPointerSession, type PointerSession } from './pointer-session';

export const MOVE_DURATION_MS = 200;

export type BoardController = BoardHandlers & {
  readonly model: ChessBoardModel;
  readonly session: PointerSession;
  readonly host: Accessor<HTMLElement | undefined>;
  readonly setHost: (el: HTMLElement) => void;
  readonly boardPx: Accessor<number>;
  readonly cursor: Accessor<Square>;
  readonly dragAt: Accessor<{ x: number; y: number } | null>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly animated: Accessor<boolean>;
  readonly theme: Accessor<ReturnType<typeof mergeBoardTheme>>;
  readonly arrows: Accessor<
    ReturnType<ReturnType<typeof createUserArrows>['arrows']>
  >;
};

function useBoardPx(el: Accessor<HTMLElement | undefined>): Accessor<number> {
  const [px, setPx] = createSignal(0);
  createEffect(() => {
    const node = el();
    if (node === undefined) return;
    const ro = new ResizeObserver((entries) => {
      setPx(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(node);
    setPx(node.getBoundingClientRect().width);
    onCleanup(() => ro.disconnect());
  });
  return px;
}

export function createBoardController(args: {
  readonly props: ChessBoardProps;
  readonly colorScheme: Accessor<BoardColorScheme>;
  readonly timers: Timers;
}): BoardController {
  const props = args.props;
  const [host, setHost] = createSignal<HTMLElement | undefined>();
  const boardPx = useBoardPx(host);
  const [cursor, setCursor] = createSignal(
    defaultCursorSquare(props.orientation ?? 'white')
  );
  const [dragAt, setDragAt] = createSignal<{ x: number; y: number } | null>(
    null
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
  const model = createChessBoardModel({
    game: untrack(() => new ChessGame(props.fen)),
    fen: () => props.fen,
    fenSyncKey: () => props.fenSyncKey,
    interactive: () => props.interactive !== false,
    animated,
    moveDurationMs: MOVE_DURATION_MS,
    onMove: (m) => props.onMove?.(m),
    sounds: createChessBoardSounds(),
    timers: args.timers,
  });
  const session = createPointerSession(model.actions);
  const userArrows = createUserArrows();
  const arrows = createMemo(() => [
    ...(props.arrows ?? []),
    ...userArrows.arrows(),
  ]);
  return {
    model,
    session,
    host,
    setHost,
    boardPx,
    cursor,
    dragAt,
    orientation,
    animated,
    theme,
    arrows,
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
      setDragAt,
    }),
  };
}
