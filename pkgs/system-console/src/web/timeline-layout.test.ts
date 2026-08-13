import { describe, expect, test } from 'bun:test';

import { durationHeat, HEAT_NEUTRAL_COLOR } from './heat';
import {
  computeSegmentWidths,
  frameDatabasesChanged,
  TIMELINE_SEG_GAP_PX,
  zoomAbout,
} from './timeline-layout';

describe('computeSegmentWidths', () => {
  test('fills track when content is under-full', () => {
    const trackWidth = 1000;
    const widths = computeSegmentWidths({
      durations: [10, 10, 10, 10],
      trackWidth,
      zoom: 1,
      basePxPerMs: 0.04,
    });
    const gaps = TIMELINE_SEG_GAP_PX * 3;
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(trackWidth - gaps, 5);
    expect(widths.every((w) => w > 0)).toBe(true);
  });

  test('does not shrink when zoomed past fill', () => {
    const trackWidth = 200;
    const widths = computeSegmentWidths({
      durations: [10_000, 10_000],
      trackWidth,
      zoom: 8,
      basePxPerMs: 0.04,
    });
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(trackWidth);
  });
});

describe('zoomAbout', () => {
  test('clamps to min/max', () => {
    expect(zoomAbout({ zoom: 1, delta: 0.01 })).toBe(0.25);
    expect(zoomAbout({ zoom: 1, delta: 100 })).toBe(8);
    expect(zoomAbout({ zoom: 1, delta: 1.12 })).toBeCloseTo(1.12);
  });
});

describe('frameDatabasesChanged', () => {
  test('detects sha change, add, and remove', () => {
    expect(
      frameDatabasesChanged(
        [{ nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 }],
        [{ nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 }]
      ).changed
    ).toBe(false);

    expect(
      frameDatabasesChanged(
        [{ nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 }],
        [{ nodeId: 'server', file: 'a', sha256: '2', byteLength: 1 }]
      )
    ).toEqual({ changed: true, changedCount: 1 });

    expect(
      frameDatabasesChanged(
        [{ nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 }],
        [
          { nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 },
          { nodeId: 'alice', file: 'b', sha256: 'x', byteLength: 1 },
        ]
      ).changedCount
    ).toBe(1);

    expect(
      frameDatabasesChanged(
        [
          { nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 },
          { nodeId: 'alice', file: 'b', sha256: 'x', byteLength: 1 },
        ],
        [{ nodeId: 'server', file: 'a', sha256: '1', byteLength: 1 }]
      ).changedCount
    ).toBe(1);
  });
});

describe('durationHeat slow-only', () => {
  test('fast frames are neutral; slow frames heat up', () => {
    const fast = durationHeat(13);
    const cool = durationHeat(100);
    const warm = durationHeat(1000);
    const hot = durationHeat(3000);
    expect(fast.t).toBe(0);
    expect(cool.t).toBe(0);
    expect(fast.cssColor).toBe(HEAT_NEUTRAL_COLOR);
    expect(cool.cssColor).toBe(HEAT_NEUTRAL_COLOR);
    expect(warm.t).toBeGreaterThan(0.4);
    expect(hot.t).toBe(1);
    expect(hot.cssColor).toContain('hsl(');
  });
});
