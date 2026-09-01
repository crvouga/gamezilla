/**
 * Smoke: defineProductSystem wiring (no SQL boot — openWorld would migrate).
 */

import { defineProductSystem, PRODUCT_SYSTEM, productSimNode } from './index';

describe('sim.product system', () => {
  it('registers id sim.product', () => {
    expect(PRODUCT_SYSTEM.id).toBe('sim.product');
  });

  it('defineProductSystem accepts createOpts and startMs', () => {
    const startMs = 1_700_000_000_000;
    const system = defineProductSystem({ seed: 1, startMs });
    expect(system.id).toBe('sim.product');
    expect(system.startMs).toBe(startMs);
    expect(system.nodes.map((n) => n.kind)).toEqual([productSimNode]);
    const bag = system.state?.();
    expect(bag?.createOpts.startMs).toBe(startMs);
    expect(bag?.sim).toBeNull();
  });
});
