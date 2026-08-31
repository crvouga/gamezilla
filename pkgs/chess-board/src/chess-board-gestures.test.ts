import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';

import {
  firePanCancelWithoutEnd,
  panEventStream,
} from './chess-board-gestures';

describe('panEventStream', () => {
  it('emits BEGAN → ACTIVE → move → END with from/to pixels', () => {
    const from = { x: 10, y: 20 };
    const to = { x: 30, y: 40 };
    const stream = panEventStream(from, to);
    expect(stream).toHaveLength(4);
    expect(stream[0]).toMatchObject({
      oldState: State.UNDETERMINED,
      state: State.BEGAN,
      x: 10,
      y: 20,
      absoluteX: 10,
      absoluteY: 20,
    });
    expect(stream[1]).toMatchObject({
      oldState: State.BEGAN,
      state: State.ACTIVE,
      x: 10,
      y: 20,
    });
    expect(stream[2]).toMatchObject({
      state: State.ACTIVE,
      x: 30,
      y: 40,
      absoluteX: 30,
      absoluteY: 40,
    });
    expect(stream[3]).toMatchObject({
      oldState: State.ACTIVE,
      state: State.END,
      x: 30,
      y: 40,
    });
  });
});

describe('firePanCancelWithoutEnd', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ends as CANCELLED without END (web pointer-up stream)', () => {
    const emit = jest.spyOn(DeviceEventEmitter, 'emit');
    const from = { x: 1, y: 2 };
    const to = { x: 5, y: 6 };
    firePanCancelWithoutEnd(99, from, to);

    const stateChanges = emit.mock.calls.filter(
      ([event]) => event === 'onGestureHandlerStateChange'
    );
    const states = stateChanges.map(
      ([, payload]) =>
        (payload as { nativeEvent: { state: number } }).nativeEvent.state
    );
    expect(states).toEqual([State.BEGAN, State.ACTIVE, State.CANCELLED]);
    expect(states).not.toContain(State.END);

    const last = stateChanges.at(-1)?.[1] as {
      nativeEvent: { handlerTag: number; state: number; x: number; y: number };
    };
    expect(last.nativeEvent).toMatchObject({
      handlerTag: 99,
      state: State.CANCELLED,
      x: 5,
      y: 6,
    });
  });
});
