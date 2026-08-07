import { describe, expect, test } from 'bun:test';
import {
  MODAL_WIDTH_PX,
  type ModalSize,
  resolveModalLayoutWidth,
} from './modal-size';

const MARGIN = 16;
const WIDE = 1200;

describe('resolveModalLayoutWidth', () => {
  test('fixed buckets use design px on a wide viewport', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      expect(resolveModalLayoutWidth(size, WIDE, MARGIN)).toBe(
        MODAL_WIDTH_PX[size]
      );
    }
  });

  test('large clamps on a narrow viewport', () => {
    expect(resolveModalLayoutWidth('large', 320, MARGIN)).toBe(288);
  });

  test('fullWidth fills layout minus gutters', () => {
    expect(resolveModalLayoutWidth('fullWidth', 800, MARGIN)).toBe(768);
  });

  test('tiny layout still returns a readable minimum width', () => {
    expect(resolveModalLayoutWidth('medium', 100, MARGIN)).toBe(200);
    expect(resolveModalLayoutWidth('fullWidth', 40, MARGIN)).toBe(200);
  });

  test('all sizes are defined', () => {
    const sizes: ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];
    for (const size of sizes) {
      expect(resolveModalLayoutWidth(size, WIDE, MARGIN)).toBeGreaterThan(0);
    }
  });
});
