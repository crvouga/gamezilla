import { describe, expect, test } from 'bun:test';
import {
  MODAL_WIDTH_PX,
  resolveModalLayoutMaxHeight,
  resolveModalLayoutWidth,
} from '@pkgs/ui-root-shared-ts/modal-size';

describe('resolveModalLayoutWidth', () => {
  const margin = 16;

  test('clamps bucket widths to the available layout width', () => {
    expect(resolveModalLayoutWidth('medium', 1280, margin)).toBe(
      MODAL_WIDTH_PX.medium
    );
    expect(resolveModalLayoutWidth('medium', 320, margin)).toBe(
      320 - margin * 2
    );
    expect(resolveModalLayoutWidth('large', 400, margin)).toBe(
      400 - margin * 2
    );
  });

  test('small keeps a further inset, so it stands inside a full-width surface', () => {
    expect(resolveModalLayoutWidth('small', 1280, margin)).toBe(
      MODAL_WIDTH_PX.small
    );
    // A phone: 390 - 2 * 16 margin - 2 * 20 inset.
    expect(resolveModalLayoutWidth('small', 390, margin)).toBe(318);
    expect(resolveModalLayoutWidth('small', 390, margin)).toBeLessThan(
      resolveModalLayoutWidth('fullWidth', 390, margin)
    );
  });

  test('fullWidth fills available width with a floor', () => {
    expect(resolveModalLayoutWidth('fullWidth', 500, margin)).toBe(
      500 - margin * 2
    );
    expect(resolveModalLayoutWidth('fullWidth', 40, margin)).toBe(200);
  });
});

describe('resolveModalLayoutMaxHeight', () => {
  test('insets equally from top and bottom with a floor', () => {
    expect(resolveModalLayoutMaxHeight(800, 16)).toBe(800 - 32);
    expect(resolveModalLayoutMaxHeight(100, 16)).toBe(200);
  });
});
