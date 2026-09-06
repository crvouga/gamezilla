/**
 * Pointer / keyboard handlers for the chess board host.
 */

import { xyToSquare } from '@pkgs/chess-board-core/geometry';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core/types';
import type { Accessor, Setter } from 'solid-js';

import { pxToUnits } from './board-units';
import type { UserArrows } from './chess-board-user-arrows';
import type { ChessBoardModel } from './create-chess-board-model';
import { isArrowKey, moveCursor } from './keyboard-nav';
import type { PointerSession } from './pointer-session';

function squareAt(args: {
  event: { clientX: number; clientY: number };
  host: HTMLElement;
  boardPx: number;
  orientation: BoardOrientation;
}): Square | null {
  const rect = args.host.getBoundingClientRect();
  return xyToSquare(
    args.event.clientX - rect.left,
    args.event.clientY - rect.top,
    args.boardPx,
    args.orientation
  );
}

export type BoardHandlers = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerUp: (event: PointerEvent) => void;
  readonly onPointerCancel: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  readonly onContextMenu: (event: MouseEvent) => void;
};

type HandlerArgs = {
  readonly host: Accessor<HTMLElement | undefined>;
  readonly boardPx: Accessor<number>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly enableUserArrows: Accessor<boolean>;
  readonly session: PointerSession;
  readonly model: ChessBoardModel;
  readonly userArrows: UserArrows;
  readonly cursor: Accessor<Square>;
  readonly setCursor: Setter<Square>;
  readonly setDragAt: Setter<{ x: number; y: number } | null>;
};

function createPointerPart(
  args: HandlerArgs
): Pick<
  BoardHandlers,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
> {
  const at = (event: { clientX: number; clientY: number }): Square | null => {
    const node = args.host();
    if (node === undefined) return null;
    return squareAt({
      event,
      host: node,
      boardPx: args.boardPx(),
      orientation: args.orientation(),
    });
  };
  return {
    onPointerDown(event) {
      const node = args.host();
      if (node === undefined || event.button !== 0) return;
      if (args.enableUserArrows()) args.userArrows.clear();
      node.setPointerCapture(event.pointerId);
      const sq = at(event);
      args.session.down(sq);
      if (sq !== null) args.setCursor(sq);
    },
    onPointerMove(event) {
      if (args.session.state().kind !== 'drag') return;
      const node = args.host();
      if (node === undefined) return;
      const rect = node.getBoundingClientRect();
      const px = args.boardPx();
      args.setDragAt({
        x: pxToUnits(event.clientX - rect.left, px),
        y: pxToUnits(event.clientY - rect.top, px),
      });
    },
    onPointerUp(event) {
      if (event.button === 2 && args.enableUserArrows()) {
        args.userArrows.end(at(event));
        return;
      }
      const sq = at(event);
      const before = args.session.state();
      args.session.up(sq);
      args.setDragAt(null);
      if (before.kind === 'drag' && sq !== null && sq !== before.from) {
        args.model.markSnap(sq);
      }
    },
    onPointerCancel() {
      args.session.cancel();
      args.setDragAt(null);
    },
  };
}

function createKeyPart(
  args: HandlerArgs
): Pick<BoardHandlers, 'onKeyDown' | 'onContextMenu'> {
  return {
    onKeyDown(event) {
      if (isArrowKey(event.key)) {
        event.preventDefault();
        const next = moveCursor(args.cursor(), event.key, args.orientation());
        if (next !== null) args.setCursor(next);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        args.session.down(args.cursor());
        args.session.up(args.cursor());
      }
    },
    onContextMenu(event) {
      if (!args.enableUserArrows()) return;
      event.preventDefault();
      const node = args.host();
      if (node === undefined) return;
      const sq = squareAt({
        event,
        host: node,
        boardPx: args.boardPx(),
        orientation: args.orientation(),
      });
      if (sq !== null) args.userArrows.begin(sq);
    },
  };
}

export function createBoardHandlers(args: HandlerArgs): BoardHandlers {
  return { ...createPointerPart(args), ...createKeyPart(args) };
}
