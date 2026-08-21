import { describe, expect, test } from 'bun:test';

import {
  frameIndexFromX,
  scrubThumbFraction,
  scrubTickFractions,
} from './frame-scrubber';

describe('frameIndexFromX', () => {
  test('returns 0 for empty or single-frame timelines', () => {
    expect(frameIndexFromX({ x: 50, width: 100, frameCount: 0 })).toBe(0);
    expect(frameIndexFromX({ x: 50, width: 100, frameCount: 1 })).toBe(0);
  });

  test('maps edges and midpoint for multiple frames', () => {
    expect(frameIndexFromX({ x: 0, width: 100, frameCount: 5 })).toBe(0);
    expect(frameIndexFromX({ x: 100, width: 100, frameCount: 5 })).toBe(4);
    expect(frameIndexFromX({ x: 50, width: 100, frameCount: 5 })).toBe(2);
  });

  test('clamps outside the track', () => {
    expect(frameIndexFromX({ x: -20, width: 100, frameCount: 5 })).toBe(0);
    expect(frameIndexFromX({ x: 140, width: 100, frameCount: 5 })).toBe(4);
  });
});

describe('scrubThumbFraction', () => {
  test('returns 0 for one or fewer frames', () => {
    expect(scrubThumbFraction({ selectedIndex: 0, frameCount: 0 })).toBe(0);
    expect(scrubThumbFraction({ selectedIndex: 0, frameCount: 1 })).toBe(0);
  });

  test('spans 0…1 across the frame range', () => {
    expect(scrubThumbFraction({ selectedIndex: 0, frameCount: 5 })).toBe(0);
    expect(scrubThumbFraction({ selectedIndex: 2, frameCount: 5 })).toBe(0.5);
    expect(scrubThumbFraction({ selectedIndex: 4, frameCount: 5 })).toBe(1);
  });
});

describe('scrubTickFractions', () => {
  test('returns empty for zero frames', () => {
    expect(scrubTickFractions(0)).toEqual([]);
  });

  test('returns a single stop for one frame', () => {
    expect(scrubTickFractions(1)).toEqual([0]);
  });

  test('places one tick per discrete state from 0…1', () => {
    expect(scrubTickFractions(5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
