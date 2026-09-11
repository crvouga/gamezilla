import {
  computeTooltipShiftX,
  TOOLTIP_EDGE_MARGIN,
} from '@pkgs/ui/components/tooltip';
import { describe, expect, test } from 'vitest';

describe('computeTooltipShiftX', () => {
  test('returns 0 when the centered bubble already fits', () => {
    expect(
      computeTooltipShiftX({
        anchorX: 200,
        anchorWidth: 40,
        bubbleWidth: 100,
        viewportWidth: 400,
      })
    ).toBe(0);
  });

  test('shifts left when the bubble would overflow the right edge', () => {
    // Center at 380; natural left = 330; max left = 400 - 100 - 8 = 292.
    expect(
      computeTooltipShiftX({
        anchorX: 360,
        anchorWidth: 40,
        bubbleWidth: 100,
        viewportWidth: 400,
      })
    ).toBe(292 - 330);
  });

  test('shifts right when the bubble would overflow the left edge', () => {
    // Center at 20; natural left = -30; min left = 8.
    expect(
      computeTooltipShiftX({
        anchorX: 0,
        anchorWidth: 40,
        bubbleWidth: 100,
        viewportWidth: 400,
      })
    ).toBe(8 - -30);
  });

  test('pins to the left margin when the bubble is wider than the viewport', () => {
    expect(
      computeTooltipShiftX({
        anchorX: 100,
        anchorWidth: 40,
        bubbleWidth: 500,
        viewportWidth: 400,
      })
    ).toBe(TOOLTIP_EDGE_MARGIN - (120 - 250));
  });

  test('returns 0 for empty layout measurements', () => {
    expect(
      computeTooltipShiftX({
        anchorX: 0,
        anchorWidth: 40,
        bubbleWidth: 0,
        viewportWidth: 400,
      })
    ).toBe(0);
    expect(
      computeTooltipShiftX({
        anchorX: 0,
        anchorWidth: 40,
        bubbleWidth: 100,
        viewportWidth: 0,
      })
    ).toBe(0);
  });
});
