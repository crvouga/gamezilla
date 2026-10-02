import { expect, test } from 'bun:test';
import { widgetPosition } from '@pkgs/feedback/client';

// regression: feedback-widget-handle-offscreen
test('an oversized feedback widget keeps its grab handle inside the viewport', () => {
  expect(
    widgetPosition(
      { x: -104.710938, y: -200.070313 },
      { width: 1024, height: 600 },
      { width: 416, height: 738 }
    )
  ).toEqual({ x: -104.710938, y: 186 });
});
