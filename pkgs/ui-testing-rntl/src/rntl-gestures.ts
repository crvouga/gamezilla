/**
 * RNTL coordinate gestures via react-native-gesture-handler Jest utils.
 * Prefer `${testID}-tap` / `${testID}-pan` handlers (chess-board convention);
 * fall back to press-with-location when no RNGH handler is registered.
 */

import type {
  ElementLayout,
  TapPosition,
} from '@pkgs/ui-testing/driver/driver';
import { fireEvent } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import type { ReactTestInstance } from 'react-test-renderer';
import { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';

/** Return type of RNGH `getByGestureTestId` — accepted by `fireGestureHandler`. */
type GestureHandlerTarget = ReturnType<typeof getByGestureTestId>;

export function readStyleSize(
  element: ReactTestInstance
): { width: number; height: number } | null {
  const list = flattenStyleList(element.props['style']);
  let width: number | undefined;
  let height: number | undefined;
  for (const entry of list) {
    if (entry == null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (typeof record['width'] === 'number' && record['width'] > 0) {
      width = record['width'];
    }
    if (typeof record['height'] === 'number' && record['height'] > 0) {
      height = record['height'];
    }
  }
  if (width !== undefined && height !== undefined) {
    return { width, height };
  }
  if (width !== undefined) {
    return { width, height: width };
  }
  return null;
}

/**
 * Ensure the element has a measurable box. RNTL has no Yoga, so boards that
 * size via `onLayout` never mount their canvas unless we synthesize layout.
 */
export function ensureElementLayout(element: ReactTestInstance): ElementLayout {
  const fromStyle = readStyleSize(element);
  const width = fromStyle?.width ?? MULTI_APP_ACTOR_FRAME.width;
  const height = fromStyle?.height ?? width;
  const onLayout = element.props['onLayout'];
  if (typeof onLayout === 'function') {
    fireEvent(element, 'layout', {
      nativeEvent: {
        layout: { x: 0, y: 0, width, height },
      },
    });
  }
  return { x: 0, y: 0, width, height };
}

export function pixelFromRatio(
  layout: ElementLayout,
  position: TapPosition
): { x: number; y: number } {
  return {
    x: layout.width * position.xRatio,
    y: layout.height * position.yRatio,
  };
}

export function fireTapAt(
  element: ReactTestInstance,
  position: TapPosition
): void {
  const layout = ensureElementLayout(element);
  const point = pixelFromRatio(layout, position);
  const testId = readTestId(element);
  if (testId !== null) {
    const tap = tryGetGesture(`${testId}-tap`);
    if (tap !== null) {
      fireTapGesture(tap, point);
      return;
    }
  }
  fireEvent.press(element, {
    nativeEvent: {
      locationX: point.x,
      locationY: point.y,
      pageX: point.x,
      pageY: point.y,
    },
  });
}

export function fireDrag(
  element: ReactTestInstance,
  from: TapPosition,
  to: TapPosition
): void {
  const layout = ensureElementLayout(element);
  const start = pixelFromRatio(layout, from);
  const end = pixelFromRatio(layout, to);
  const testId = readTestId(element);
  if (testId === null) {
    throw new Error('drag: element has no testID for pan gesture lookup');
  }
  const pan = tryGetGesture(`${testId}-pan`);
  if (pan === null) {
    throw new Error(
      `drag: no pan gesture registered for testID "${testId}-pan"`
    );
  }
  fireGestureHandler(pan, panEventStream(start, end));
}

function readTestId(element: ReactTestInstance): string | null {
  const props = element.props as {
    testID?: unknown;
    'data-testid'?: unknown;
  };
  if (typeof props.testID === 'string' && props.testID.length > 0) {
    return props.testID;
  }
  if (
    typeof props['data-testid'] === 'string' &&
    props['data-testid'].length > 0
  ) {
    return props['data-testid'];
  }
  return null;
}

function tryGetGesture(testId: string): GestureHandlerTarget | null {
  try {
    return getByGestureTestId(testId);
  } catch {
    return null;
  }
}

function fireTapGesture(
  handler: GestureHandlerTarget,
  point: { x: number; y: number }
): void {
  fireGestureHandler(handler, [
    {
      oldState: State.UNDETERMINED,
      state: State.BEGAN,
      x: point.x,
      y: point.y,
      absoluteX: point.x,
      absoluteY: point.y,
    },
    {
      oldState: State.BEGAN,
      state: State.ACTIVE,
      x: point.x,
      y: point.y,
      absoluteX: point.x,
      absoluteY: point.y,
    },
    {
      oldState: State.ACTIVE,
      state: State.END,
      x: point.x,
      y: point.y,
      absoluteX: point.x,
      absoluteY: point.y,
    },
  ]);
}

function panEventStream(
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

function flattenStyleList(style: unknown): unknown[] {
  if (!Array.isArray(style)) return [style];
  const out: unknown[] = [];
  const stack: unknown[] = [...style];
  while (stack.length > 0) {
    const next = stack.pop();
    if (Array.isArray(next)) {
      for (let i = next.length - 1; i >= 0; i -= 1) {
        stack.push(next[i]);
      }
      continue;
    }
    out.push(next);
  }
  return out;
}
