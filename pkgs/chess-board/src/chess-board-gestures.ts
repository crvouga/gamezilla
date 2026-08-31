import type { BoardOrientation } from '@pkgs/chess-board/chess-board-types';
import { DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { squareCenter } from './chess-board-squares';

/** Matches Gesture.Pan().withTestId in production. */
export const CHESS_BOARD_PAN_TEST_ID = 'chess-board-pan';
/** Matches Gesture.Tap().withTestId in production. */
export const CHESS_BOARD_TAP_TEST_ID = 'chess-board-tap';

export type PointerUp = 'end' | 'cancel';

const DEFAULT_BOARD_SIZE = 320;

export function panEventStream(
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  return [
    {
      oldState: State.UNDETERMINED,
      state: State.BEGAN,
      x: from.x,
      y: from.y,
      absoluteX: from.x,
      absoluteY: from.y,
    },
    {
      oldState: State.BEGAN,
      state: State.ACTIVE,
      x: from.x,
      y: from.y,
      absoluteX: from.x,
      absoluteY: from.y,
    },
    {
      state: State.ACTIVE,
      x: to.x,
      y: to.y,
      absoluteX: to.x,
      absoluteY: to.y,
    },
    {
      oldState: State.ACTIVE,
      state: State.END,
      x: to.x,
      y: to.y,
      absoluteX: to.x,
      absoluteY: to.y,
    },
  ];
}

/**
 * Web playground pointer-up often ends the pan as CANCELLED without END.
 * RNGH `fireGestureHandler` always appends END, so emit the stream ourselves.
 */
export function firePanCancelWithoutEnd(
  handlerTag: number,
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  const tag = handlerTag;
  const emitState = (
    oldState: number,
    state: number,
    pt: { x: number; y: number }
  ) => {
    DeviceEventEmitter.emit('onGestureHandlerStateChange', {
      nativeEvent: {
        handlerTag: tag,
        oldState,
        state,
        x: pt.x,
        y: pt.y,
        absoluteX: pt.x,
        absoluteY: pt.y,
        translationX: pt.x - from.x,
        translationY: pt.y - from.y,
        velocityX: 0,
        velocityY: 0,
        numberOfPointers: 1,
      },
    });
  };
  const emitMove = (pt: { x: number; y: number }) => {
    DeviceEventEmitter.emit('onGestureHandlerEvent', {
      nativeEvent: {
        handlerTag: tag,
        state: State.ACTIVE,
        x: pt.x,
        y: pt.y,
        absoluteX: pt.x,
        absoluteY: pt.y,
        translationX: pt.x - from.x,
        translationY: pt.y - from.y,
        velocityX: 0,
        velocityY: 0,
        numberOfPointers: 1,
      },
    });
  };
  emitState(State.UNDETERMINED, State.BEGAN, from);
  emitState(State.BEGAN, State.ACTIVE, from);
  emitMove(to);
  emitState(State.ACTIVE, State.CANCELLED, to);
}

export function dragPiece(
  fromSquare: string,
  toSquare: string,
  opts?: {
    pointerUp?: PointerUp;
    size?: number;
    orientation?: BoardOrientation;
  }
): void {
  const size = opts?.size ?? DEFAULT_BOARD_SIZE;
  const orientation = opts?.orientation ?? 'white';
  const pointerUp = opts?.pointerUp ?? 'end';
  const from = squareCenter(fromSquare, size, orientation);
  const to = squareCenter(toSquare, size, orientation);
  const pan = getByGestureTestId(CHESS_BOARD_PAN_TEST_ID);
  if (pointerUp === 'cancel') {
    firePanCancelWithoutEnd(
      (pan as { handlerTag: number }).handlerTag,
      from,
      to
    );
    return;
  }
  fireGestureHandler(pan, panEventStream(from, to));
}

export function tapSquare(
  square: string,
  opts?: { size?: number; orientation?: BoardOrientation }
): void {
  const size = opts?.size ?? DEFAULT_BOARD_SIZE;
  const orientation = opts?.orientation ?? 'white';
  const { x, y } = squareCenter(square, size, orientation);
  const tap = getByGestureTestId(CHESS_BOARD_TAP_TEST_ID);
  fireGestureHandler(tap, [
    {
      oldState: State.UNDETERMINED,
      state: State.BEGAN,
      x,
      y,
      absoluteX: x,
      absoluteY: y,
    },
    {
      oldState: State.BEGAN,
      state: State.ACTIVE,
      x,
      y,
      absoluteX: x,
      absoluteY: y,
    },
    {
      oldState: State.ACTIVE,
      state: State.END,
      x,
      y,
      absoluteX: x,
      absoluteY: y,
    },
  ]);
}
