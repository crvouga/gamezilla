import { expect, test } from 'bun:test';
import { attachElement } from '@pkgs/ui-root-client-ts/element-handle';
import { createMeasure } from '@pkgs/ui-root-client-ts/measure';
import { createRoot } from 'solid-js';

// regression: resize-observer-synchronous-layout-write
test('measurement publishes outside resize delivery and cancels a pending update on disposal', () => {
  const original = globalThis.ResizeObserver;
  const view = document.defaultView;
  if (view === null) throw new Error('Test document needs a window');
  const originalRequest = view.requestAnimationFrame;
  const originalCancel = view.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  let deliver: ResizeObserverCallback = () => {};
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      deliver = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  view.requestAnimationFrame = (callback) => {
    frames.set(++serial, callback);
    return serial;
  };
  view.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  let dispose = () => {};
  try {
    let width = 100;
    const element = document.createElement('div');
    element.getBoundingClientRect = () => new DOMRect(0, 0, width, 80);
    const measure = createRoot((stop) => {
      dispose = stop;
      const result = createMeasure();
      attachElement(result.target, element);
      return result;
    });
    expect(measure.width()).toBe(100);
    width = 240;
    deliver([], {} as ResizeObserver);
    expect(measure.width()).toBe(100);
    width = 320;
    deliver([], {} as ResizeObserver);
    expect(frames.size).toBe(1);
    for (const [id, callback] of frames) {
      frames.delete(id);
      callback(0);
    }
    expect(measure.width()).toBe(320);
    deliver([], {} as ResizeObserver);
    dispose();
    expect(frames.size).toBe(0);
  } finally {
    dispose();
    globalThis.ResizeObserver = original;
    view.requestAnimationFrame = originalRequest;
    view.cancelAnimationFrame = originalCancel;
  }
});
