/**
 * Smoke: product system wiring (no SQL boot).
 */

import { product } from './index';

describe('sim.product system', () => {
  it('registers name sim.product', () => {
    expect(product.name).toBe('sim.product');
  });
});
