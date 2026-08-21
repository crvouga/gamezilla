import { describe, expect, test } from 'bun:test';

import { frameIndexFromX, scrubThumbFraction } from './frame-scrubber';

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
