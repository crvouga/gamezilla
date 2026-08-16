import { describe, expect, test } from 'bun:test';
import {
  type PortalHostFrame,
  subtractHostOrigin,
  windowRectToHostLocal,
} from './portal-host-frame';

const nestedHost: PortalHostFrame = {
  x: 120,
  y: 80,
  width: 400,
  height: 700,
};

describe('portal-host-frame', () => {
  test('subtractHostOrigin removes nested panel origin', () => {
    expect(subtractHostOrigin(320, 180, nestedHost)).toEqual({
      x: 200,
      y: 100,
    });
  });

  test('windowRectToHostLocal keeps size and shifts origin', () => {
    expect(
      windowRectToHostLocal(
        { x: 480, y: 96, width: 32, height: 32 },
        nestedHost
      )
    ).toEqual({ x: 360, y: 16, width: 32, height: 32 });
  });

  test('zero host leaves window coords unchanged', () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 };
    expect(
      windowRectToHostLocal(rect, { x: 0, y: 0, width: 1000, height: 800 })
    ).toEqual(rect);
  });
});
