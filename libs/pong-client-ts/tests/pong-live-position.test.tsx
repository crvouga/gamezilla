import { expect, spyOn, test } from 'bun:test';
import { PongLiveRally } from '@libs/pong-client-ts/pong-live-rally.example';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import { render } from '@solidjs/testing-library';

// regression: pong-live-story-reencodes-position-per-reader
test('live court readers share one encoding per rendered position', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const request = spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
    (callback) => {
      frames.set(++nextId, callback);
      return nextId;
    }
  );
  const cancel = spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(
    (id) => {
      frames.delete(id);
    }
  );
  const now = spyOn(performance, 'now').mockReturnValue(0);
  const encode = spyOn(pongPositionCodec, 'encode');
  let position: (() => string) | undefined;
  let controls: GameSimulationControls | undefined;
  const view = render(() => (
    <PongLiveRally sides={['white']}>
      {(read, simulation) => {
        position = read;
        controls = simulation;
        return null;
      }}
    </PongLiveRally>
  ));
  const readConsumers = () => [position?.(), position?.(), position?.()];
  const frame = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(time);
  };
  try {
    const initial = readConsumers();
    expect(initial[0]).toStartWith('pong:');
    expect(initial).toEqual(Array(3).fill(initial[0]));
    expect(encode).toHaveBeenCalledTimes(1);
    controls?.onInput('white', { kind: 'direction', direction: 1 });
    frame(100);
    const next = readConsumers();
    expect(next[0]).not.toBe(initial[0]);
    expect(next).toEqual(Array(3).fill(next[0]));
    expect(encode).toHaveBeenCalledTimes(2);
    // No elapsed time means no new state to serialize for any consumer.
    frame(100);
    expect(readConsumers()).toEqual(next);
    expect(encode).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(frames.size).toBe(0);
  } finally {
    view.unmount();
    encode.mockRestore();
    now.mockRestore();
    request.mockRestore();
    cancel.mockRestore();
  }
});
